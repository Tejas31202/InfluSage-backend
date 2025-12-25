import { client } from '../../config/Db.js';
import { createClient } from '@supabase/supabase-js';
import Redis from '../../utils/RedisWrapper.js';
import { io } from '../../../app.js'

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export const getCampaignDetails = async (req, res) => {
  try {
    const userId = req.user?.id || req.body.userId;
    const { campaignId } = req.params;

    const result = await client.query(
      "select * from ins.fn_get_campaignbrowsedetails($1::bigint,$2::bigint)",
      [userId, campaignId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Campaign not found." });
    }

    const campaignDetails = result.rows[0].fn_get_campaignbrowsedetails;

    return res.status(200).json({ data: campaignDetails, source: "db" });
  } catch (error) {
    console.error("Error in getCampignDetails:", error);
    return res.status(500).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};

export const applyNowCampaign = async (req, res) => {
  try {
    const userId = req.user?.id || req.body.userId;
    const campaignId = req.params.campaignId;
    const redisKey = `applyCampaign:${userId}`;

    const userFolder = `${userId}`;

    let applycampaignjson = {};
    if (req.body.applycampaignjson) {
      try {
        applycampaignjson = JSON.parse(req.body.applycampaignjson);
      } catch (err) {
        return res.status(400).json({ message: "Invalid applycampaignjson format" });
      }
    }

    if (req.files && req.files.portfolioFiles) {
      const uploadedFiles = [];

      for (const file of req.files.portfolioFiles) {
        const fileName = file.originalname;
        const newFileName = `${fileName}`;
        const uniqueFileName = `Influencer/${userFolder}/Campaigns/${campaignId}/ApplyCampaigns/${newFileName}`;
        const fileBuffer = file.buffer;

        try {
          const { data: existingFiles, error: listError } = await supabase.storage
            .from(process.env.SUPABASE_BUCKET)
            .list(`Influencer/${userFolder}/Campaigns/${campaignId}/ApplyCampaigns/`, {
              search: newFileName,
            });

          if (listError) {
            console.error("Supabase list error:", listError);
            return res.status(500).json({ message: "Error checking existing files" });
          }

          const fileExists = existingFiles?.some((f) => f.name === newFileName);

          if (fileExists) {

            const { data: publicData } = supabase.storage
              .from(process.env.SUPABASE_BUCKET)
              .getPublicUrl(uniqueFileName);
            uploadedFiles.push({ filepath: publicData.publicUrl });

            continue; 
          }

          const { error: uploadError } = await supabase.storage
            .from(process.env.SUPABASE_BUCKET)
            .upload(uniqueFileName, fileBuffer, {
              contentType: file.mimetype,
              upsert: false,
            });

          if (uploadError) {
            console.error("Supabase upload error:", uploadError);
            return res
              .status(500)
              .json({ message: "Failed to upload file to cloud storage" });
          }

          const { data: publicUrlData } = supabase.storage
            .from(process.env.SUPABASE_BUCKET)
            .getPublicUrl(uniqueFileName);

          uploadedFiles.push({ filepath: publicUrlData.publicUrl });
        } catch (err) {
          console.error("Upload error:", err);
          return res.status(500).json({ message: "Unexpected upload error" });
        }
      }
      if (applycampaignjson.filepaths && Array.isArray(applycampaignjson.filepaths)) {
        applycampaignjson.filepaths = [...applycampaignjson.filepaths, ...uploadedFiles];
      } else {
        applycampaignjson.filepaths = uploadedFiles;
      }
      
    }
    await client.query("BEGIN");

    await client.query(
      "SELECT set_config('app.current_user_id', $1, true)",
      [String(userId)]
    );

    const result = await client.query(
      `CALL ins.usp_insert_campaignapplication(
        $1::bigint,
        $2::bigint,
        $3::json,
        $4::smallint,
        $5::text
      )`,
      [userId, campaignId, JSON.stringify(applycampaignjson), null, null]
    );

    await client.query("COMMIT");

    const row = result.rows[0];
    const p_status = Number(row?.p_status);
    const p_role = 'SENDER';
    const p_message = row?.p_message;

    if (p_status === 1) {
      try {
        const notification = await client.query(
          `select * from ins.fn_get_notificationlist($1::bigint,$2::boolean,$3::text)`,
          [userId, null, p_role]
        );

        const notifyData = notification.rows[0]?.fn_get_notificationlist || [];

        if (notifyData.length === 0) {
          return;
        }

        const latest = notifyData[0];
        const toUserId = latest.receiverid;

        if (!toUserId) return;

        io.to(`user_${toUserId}`).emit("receiveNotification", latest);
      } catch (err) {
        console.error("Error fetching notifications", err);
      }

      await Redis.del(redisKey);

      return res.status(200).json({
        status: true,
        message: p_message || "Application saved successfully",
        source: "db",
      });
    }

    else if (p_status === 0) {
      return res.status(400).json({
        status: false,
        message: p_message || "Validation failed",
      });
    }

    else if (p_status === -1) {
      console.error("Stored Procedure Failure:", p_message);
      return res.status(500).json({
        status: false,
        message: "Something went wrong. Please try again later.",
      });
    }

    else {
      return res.status(500).json({
        status: false,
        message: "Unexpected database response",
      });
    }

  } catch (error) {
    console.error("Error in applyNowCampaign:", error);
    return res.status(500).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};

export const getUsersAppliedCampaigns = async (req, res) => {
  try {
    const userId = req.user?.id || req.body.userId;
    const {
      p_sortby = "createddate",
      p_sortorder = "DESC",
      p_pagenumber = 1,
      p_pagesize = 20,
      p_search,
    } = {
      ...req.query,
      ...req.params,
    };
    const redisKey = `applyCampaign:${userId}:${p_sortby}:${p_sortorder}:${p_pagenumber}:${p_pagesize}`;

    const cachedData = await Redis.get(redisKey);
    if (cachedData) {
      return res.status(200).json({
        data: cachedData,
        source: "redis",
      });
    }

    const result = await client.query(
      `SELECT * FROM ins.fn_get_campaignapplication(
      $1::bigint,
      $2::text,
      $3::text,
      $4::int,
      $5::int,
      $6::text)`,

      [userId, p_sortby, p_sortorder, p_pagenumber, p_pagesize, p_search]
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ message: "No applied campaigns found." });
    }

    return res.status(200).json({
      data: result.rows[0].fn_get_campaignapplication,
      source: "db",
    });
  } catch (error) {
    console.error("Error in getUsersAppliedCampaigns:", error.message);
    return res.status(500).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};

export const saveCampaign = async (req, res) => {
  try {
    const userId = req.user?.id || req.body.userId;
    const campaignId = req.params.campaignId;

    if (!campaignId || !userId) {
      return res.status(400).json({
        status: false,
        message: "User ID and Campaign ID are required.",
      });
    }

    await client.query("BEGIN");
    await client.query(
      "SELECT set_config('app.current_user_id', $1, true)",
      [String(userId)]
    );
    // Call stored procedure
    const result = await client.query(
      `CALL ins.usp_insert_campaignsave(
        $1::bigint,
        $2::bigint,
        $3,
        $4
      )`,
      [userId, campaignId, null, null]
    );
    await client.query("COMMIT");

    const row = result.rows[0];
    const p_status = Number(row?.p_status);
    const p_message = row?.p_message;

    if (p_status === 1) {
      return res.status(200).json({
        status: true,
        message: p_message || "Campaign saved successfully",
      });
    }

    else if (p_status === 0) {
      return res.status(400).json({
        status: false,
        message: p_message || "Validation failed",
      });
    }

    else if (p_status === -1) {
      console.error("Stored Procedure Failure:", p_message);
      return res.status(500).json({
        status: false,
        message: "Something went wrong. Please try again later.",
      });
    }

    else {
      return res.status(500).json({
        status: false,
        message: "Unexpected database response",
      });
    }

  } catch (error) {
    console.error("Error saving campaign:", error);
    return res.status(500).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};

export const getSaveCampaign = async (req, res) => {
  try {
    const userId = req.user?.id || req.body.userId;
    if (!userId) {
      return res.status(400).json({ message: "User Id Required." });
    }

    const { sortby, sortorder, pagenumber, pagesize, p_search } = req.query;

    const result = await client.query(
      `SELECT * FROM ins.fn_get_campaignsave(
      $1:: BIGINT,
      $2:: text,
      $3:: text,
      $4:: integer,
      $5:: integer,
      $6:: text 
      )`,
      [
        userId || null,
        sortby || "createddate",
        sortorder || "DESC",
        pagenumber || 1,
        pagesize || 20,
        p_search,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Campaign not found." });
    }

    const savedcampaign = result.rows[0]?.fn_get_campaignsave;

    return res.status(200).json({ data: savedcampaign, source: "db" });
  } catch (error) {
    console.error("Error in getSaveCampaign:", error);
    return res.status(500).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};

export const getSingleApplyCampaign = async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;
    const { campaignId } = req.params;
    const redisKey = `applyCampaign:${userId}:${campaignId}`;

    const cachedData = await Redis.get(redisKey);
    if (cachedData) {
      return res.status(200).json({
        data: cachedData,
        source: "redis",
      });
    }

    const result = await client.query(
      `SELECT ins.fn_get_campaignapplicationdetails($1,$2)`,
      [userId, campaignId]
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ message: "No applied campaigns found." });
    }

    return res.status(200).json({
      data: result.rows[0]?.fn_get_campaignapplicationdetails,
      source: "db",
    });
  } catch (error) {
    console.error("Error in getSingleApplyCampaign:", error.message);
    return res.status(500).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};

export const getUserCampaignWithDetails = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { campaignId } = req.params;

    if (!userId || !campaignId) {
      return res
        .status(400)
        .json({ message: "UserId and CampaignId are required." });
    }

    let responseData = {
      campaignDetails: null,
      appliedDetails: null,
    };

    const campaignResult = await client.query(
      "select * from ins.fn_get_campaignbrowsedetails($1::bigint,$2::bigint)",
      [userId, campaignId]
    );

    if (campaignResult.rows.length > 0) {
      responseData.campaignDetails =
        campaignResult.rows[0].fn_get_campaignbrowsedetails;
    }

    const redisKey = `applyCampaign:${userId}:${campaignId}`;
    const cachedData = await Redis.get(redisKey);

    if (cachedData) {
      responseData.appliedDetails = cachedData;
    } else {
      const appliedResult = await client.query(
        `SELECT ins.fn_get_campaignapplicationdetails($1,$2)`,
        [userId, campaignId]
      );

      if (appliedResult.rows && appliedResult.rows.length > 0) {
        responseData.appliedDetails =
          appliedResult.rows[0].fn_get_campaignapplicationdetails;
      }
    }

    return res.status(200).json({ data: responseData });
  } catch (error) {
    console.error("Error in getUserCampaignWithDetails:", error.message);
    return res.status(500).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};

export const browseCampaigns = async (req, res) => {
  try {
    const userId = req.user?.id || req.body.userId;

    const {
      providers,
      contenttypes,
      languages,
      maxbudget,
      minbudget,
      sortby,
      sortorder,
      pagenumber,
      pagesize,
      p_search,
    } = req.query;

    const result = await client.query(
      `SELECT * FROM ins.fn_get_campaignbrowse(
        $1:: BIGINT,
        $2::json,
        $3::json,
        $4::json,
        $5::numeric,
        $6::numeric,
        $7::text,
        $8::text,
        $9::integer,
        $10::integer,
        $11::text
      )`,
      [
        userId,
        providers || null,
        contenttypes || null,
        languages || null,
        maxbudget || null,
        minbudget || null,
        sortby || "createddate",
        sortorder || "DESC",
        pagenumber || 1,
        pagesize || 20,
        p_search,
      ]
    );
    return res.json(result.rows[0].fn_get_campaignbrowse);
  } catch (error) {
    console.error("Error browsing campaigns:", error.message);
    return res.status(500).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};

export const withdrawApplication = async (req, res) => {
  const userId = req.user?.id || req.body.userId;

  if (!userId) {
    return res.status(401).json({
      status: false,
      message: "Unauthorized: user not found",
    });
  }
  const { p_applicationid, p_statusname } = req.body || {};

  if (!p_applicationid || !p_statusname) {
    return res
      .status(400)
      .json({ error: "Required field: p_applicationid, p_statusname" });
  }

  try {
    const p_statusname = "Withdrawn";

    await client.query("BEGIN");
    await client.query(
      "SELECT set_config('app.current_user_id', $1, true)",
      [String(userId)]
    );
    const result = await client.query(
      `CALL ins.usp_update_applicationstatus(
        $1::bigint,
        $2::varchar,
        $3::smallint,
        $4::text
      )`,
      [p_applicationid, p_statusname, null, null]
    );
    await client.query("COMMIT");

    const row = result.rows?.[0] || {};
    const p_status = Number(row.p_status);
    const p_message = row.p_message;

    // ----------------- HANDLE p_status -----------------
    if (p_status === 1) {
      return res.status(200).json({
        status: true,
        message: p_message || "Application withdrawn successfully",
        source: "db",
      });
    } else if (p_status === 0) {
      return res.status(400).json({
        status: false,
        message: p_message || "Validation failed",
        source: "db",
      });
    } else if (p_status === -1) {
      console.error("Stored Procedure Failure:", p_message);
      return res.status(500).json({
        status: false,
        message: "Something went wrong. Please try again later.",
      });
    } else {
      return res.status(500).json({
        status: false,
        message: "Unexpected database response",
      });
    }
  } catch (error) {
    console.error("Error in withdrawApplication:", error.message);
    return res.status(500).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};

export const deleteApplyNowPortfolioFile = async (req, res) => {
  const userId = req.user?.id || req.body.userId;
  const { filePath } = req.body; 
  const redisKey = `applyCampaign:${userId}`;

  try {
    if (!filePath) {
      return res.status(400).json({ message: "filePath is required" });
    }

    let campaignData = await Redis.get(redisKey);
    if (campaignData) {
      campaignData = (campaignData);

      if (campaignData.applycampaignjson?.filepaths) {
        campaignData.applycampaignjson.filepaths =
          campaignData.applycampaignjson.filepaths.filter(
            (file) => file.filepath !== filePath
          );

        // Update Redis data
        await Redis.setEx(redisKey, 7200, campaignData);
      }
    }

    const supabaseBaseURL = `${SUPABASE_URL}/storage/v1/object/public/uploads/`;
    const relativeFilePath = filePath.replace(supabaseBaseURL, "");

    const { error: deleteError } = await supabase.storage
      .from(process.env.SUPABASE_BUCKET)
      .remove([relativeFilePath]);

    if (deleteError) {
      console.error("Supabase file delete error:", deleteError);
      return res.status(500).json({
        status: false,
        message: "Failed to delete file from cloud storage",
      });
    }

    return res.status(200).json({
      status: true,
      message: "Portfolio file deleted successfully from Supabase",
      portfolioFiles: campaignData?.applycampaignjson?.filepaths || [],
    });
  } catch (error) {
    console.error("error in deleteApplyNowPortfolioFile:", error);
    return res.status(500).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};
