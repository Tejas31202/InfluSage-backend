import { client } from '../../config/Db.js';
import { createClient } from '@supabase/supabase-js';
import Redis from '../../utils/RedisWrapper.js';
import path from 'path';
import fs from 'fs';
import fsPromises from 'fs/promises';
import { io } from '../../../app.js'



const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
// const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY ,SUPABASE_KEY);
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

//For Selected Camapign Details
export const getCampaignDetails = async (req, res) => {
  try {
    const userId = req.user?.id || req.body.userId;
    const { campaignId } = req.params;

    const result = await client.query(
      "select * from ins.fn_get_campaignbrowsedetails($1::bigint,$2::bigint)",
      [userId, campaignId]
    );

    //Check From DB Not Found Campaign
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Campaign not found." });
    }

    const campaignDetails = result.rows[0].fn_get_campaignbrowsedetails;

    return res.status(200).json({ data: campaignDetails, source: "db" });
  } catch (error) {
    console.error("Error fetching campaign details:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

//For Apply Campaign
export const applyNowCampaign = async (req, res) => {
  try {
    const userId = req.user?.id || req.body.userId;
    const campaignId = req.params.campaignId;
    const redisKey = `applyCampaign:${userId}`;

    let username = "user";

    if (req.user?.name) {
      // Split by space and take first word
      username = req.user.name.split(" ")[0].trim();
    }

    //  Fallback: from request body
    else if (req.body?.firstName) {
      username = req.body.firstName.trim();
    }

    // Final fallback: from DB
    else {
      const dbUser = await client.query(
        "SELECT firstname FROM ins.users WHERE id=$1",
        [userId]
      );
      if (dbUser.rows[0]?.firstname) {
        username = dbUser.rows[0].firstname.trim();
      }
    }

    // // Clean username to remove any special chars
    // username = username.replace(/\W+/g, "_");

    // Unique folder name pattern
    const userFolder = `${userId}`;

    // Parse JSON from form-data
    let applycampaignjson = {};
    if (req.body.applycampaignjson) {
      try {
        applycampaignjson = JSON.parse(req.body.applycampaignjson);
      } catch (err) {
        return res.status(400).json({ message: "Invalid applycampaignjson format" });
      }
    }

    // File upload to Supabase
    if (req.files && req.files.portfolioFiles) {
      const uploadedFiles = [];

      for (const file of req.files.portfolioFiles) {
        const fileName = file.originalname;
        const newFileName = `${fileName}`;
        const uniqueFileName = `Influencer/${userFolder}/Campaigns/${campaignId}/ApplyCampaigns/${newFileName}`;
        const fileBuffer = file.buffer;

    try {
      // Step 1: Check if file already exists in Supabase bucket
      const { data: existingFiles, error: listError } = await supabase.storage
        .from(process.env.SUPABASE_BUCKET)
        .list(`Influencer/${userFolder}/CampaignId_${campaignId}/ApplyCampaigns/`, {
          search: newFileName,
        });

          if (listError) {
            console.error("Supabase list error:", listError);
            return res.status(500).json({ message: "Error checking existing files" });
          }

          const fileExists = existingFiles?.some((f) => f.name === newFileName);

          if (fileExists) {
            // res.status(400).json({ message: `File already exists: ${fileName}, skipping upload.` });

            //add existing file URL to uploadedFiles
            const { data: publicData } = supabase.storage
              .from(process.env.SUPABASE_BUCKET)
              .getPublicUrl(uniqueFileName);
            uploadedFiles.push({ filepath: publicData.publicUrl });

            continue; // Skip upload, go to next file

          }

          // Step 2: Upload if file doesn’t exist
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

          // Step 3: Get public URL for the uploaded file
          const { data: publicUrlData } = supabase.storage
            .from(process.env.SUPABASE_BUCKET)
            .getPublicUrl(uniqueFileName);

          uploadedFiles.push({ filepath: publicUrlData.publicUrl });
        } catch (err) {
          console.error("Upload error:", err);
          return res.status(500).json({ message: "Unexpected upload error" });
        }
      }
      // Merge old + new filepaths
      if (applycampaignjson.filepaths && Array.isArray(applycampaignjson.filepaths)) {
        applycampaignjson.filepaths = [...applycampaignjson.filepaths, ...uploadedFiles];
      } else {
        applycampaignjson.filepaths = uploadedFiles;
      }
    }

    // Save data in DB via stored procedure
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

    // After stored procedure call
    const row = result.rows[0];
    const p_status = Number(row?.p_status);
    const p_role = 'SENDER';
    const p_message = row?.p_message;

    // Case 1: p_status = 1 → SUCCESS
    if (p_status === 1) {
      try {
        const notification = await client.query(
          `select * from ins.fn_get_notificationlist($1::bigint,$2::boolean,$3::text)`,
          [userId, null, p_role]
        );
        const notifyData = notification.rows[0]?.fn_get_notificationlist || [];
        console.log("new data", notifyData );

        if (notifyData.length === 0) {
          console.log("No notifications found.");
        } else {
          console.log(notifyData);
          const latest = notifyData[0];

          const toUserId = latest.receiverid;

          if (toUserId) {
            io.to(`user_${toUserId}`).emit("receiveNotification", notifyData);
            console.log("📩 Sent to:", toUserId);
          }
        }
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

    // Case 2: p_status = 0 → DB VALIDATION FAIL
    else if (p_status === 0) {
      return res.status(400).json({
        status: false,
        message: p_message || "Validation failed",
      });
    }

    // Case 3: p_status = -1 → PROCEDURE FAILED
    else if (p_status === -1) {
      return res.status(500).json({
        status: false,
        message: "Something went wrong. Please try again later.",
      });
    }

    // Fallback: if unexpected value
    else {
      return res.status(500).json({
        status: false,
        message: "Unexpected database response",
      });
    }

  } catch (error) {
    console.error("Error applying to campaign:", error);
    return res.status(500).json({ message: error.message });
  }
};
 

//For Applied Campaign
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

    //Try Cache First From Redis
    const cachedData = await Redis.get(redisKey);
    if (cachedData) {
      return res.status(200).json({
        data: cachedData,
        source: "redis",
      });
    }

    //If Not In Redis → Fetch From DB (don't save in Redis)
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

    //Check Db Return Data OR Not
    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ message: "No applied campaigns found." });
    }

    //Return Data From Db
    return res.status(200).json({
      data: result.rows[0].fn_get_campaignapplication,
      source: "db",
    });
  } catch (error) {
    console.error("Error fetching applied campaigns:", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

//For Save Campaign
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

    const row = result.rows[0];
    const p_status = Number(row?.p_status);
    const p_message = row?.p_message;

    // -------------------------
    //      STATUS HANDLING
    // -------------------------

    // Case 1 → p_status = 1 (Success)
    if (p_status === 1) {
      return res.status(200).json({
        status: true,
        message: p_message || "Campaign saved successfully",
      });
    }

    // Case 2 → p_status = 0 (Validation fail)
    else if (p_status === 0) {
      return res.status(400).json({
        status: false,
        message: p_message || "Validation failed",
      });
    }

    // Case 3 → p_status = -1 (SP failed)
    else if (p_status === -1) {
      return res.status(500).json({
        status: false,
        message: "Something went wrong. Please try again later.",
      });
    }

    // Unexpected case
    else {
      return res.status(500).json({
        status: false,
        message: "Unexpected database response",
      });
    }

  } catch (error) {
    console.error("Error saving campaign:", error);
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
    });
  }
};


//For Get Save Camapign
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
    console.error("Error saving campaign application:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

//For Apply Single Campaign
export const getSingleApplyCampaign = async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;
    const { campaignId } = req.params;
    const redisKey = `applyCampaign:${userId}:${campaignId}`;

    // 1 Try cache first
    const cachedData = await Redis.get(redisKey);
    if (cachedData) {
      return res.status(200).json({
        data: cachedData,
        source: "redis",
      });
    }

    // 2 If not in Redis → fetch from DB (❌ don't save in Redis)
    const result = await client.query(
      `SELECT ins.fn_get_campaignapplicationdetails($1,$2)`,
      [userId, campaignId]
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ message: "No applied campaigns found." });
    }

    // 3 Just return DB response directly
    return res.status(200).json({
      data: result.rows[0]?.fn_get_campaignapplicationdetails,
      source: "db",
    });
  } catch (error) {
    console.error("Error fetching applied campaigns:", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

//For Get user Campign With Details
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

    // 1 Get campaign details (from DB)
    const campaignResult = await client.query(
      "select * from ins.fn_get_campaignbrowsedetails($1::bigint,$2::bigint)",
      [userId, campaignId]
    );

    if (campaignResult.rows.length > 0) {
      responseData.campaignDetails =
        campaignResult.rows[0].fn_get_campaignbrowsedetails;
    }

    // 2 Get applied campaign details (check Redis first)
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

    // 3 Return combined response
    return res.status(200).json({ data: responseData });
  } catch (error) {
    console.error("Error fetching campaign with details:", error.message);
    return res
      .status(500)
      .json({ status: false, message: "Internal Server Error" });
  }
};

//For Browse Campaigns
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
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

export const withdrawApplication = async (req, res) => {
  const { p_applicationid, p_statusname } = req.body || {};

  if (!p_applicationid || !p_statusname) {
    return res
      .status(400)
      .json({ error: "Required field: p_applicationid, p_statusname" });
  }

  try {
    const p_statusname = "Withdrawn";

    const result = await client.query(
      `CALL ins.usp_update_applicationstatus(
        $1::bigint,
        $2::varchar,
        $3::smallint,
        $4::text
      )`,
      [p_applicationid, p_statusname, null, null]
    );

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
    console.error("Error in withdraw application:", error.message);
    return res.status(500).json({ message: error.message });
  }
};

export const deleteApplyNowPortfolioFile = async (req, res) => {
  const userId = req.user?.id || req.body.userId;
  const { filePath } = req.body; // this is the public URL
  const redisKey = `applyCampaign:${userId}`;

  try {
    if (!filePath) {
      return res.status(400).json({ message: "filePath is required" });
    }

    // Step 1: Redis se data fetch karo
    let campaignData = await Redis.get(redisKey);
    if (campaignData) {
      campaignData = (campaignData);

      // Redis se file remove karo
      if (campaignData.applycampaignjson?.filepaths) {
        campaignData.applycampaignjson.filepaths =
          campaignData.applycampaignjson.filepaths.filter(
            (file) => file.filepath !== filePath
          );

        // Update Redis data
        await Redis.setEx(redisKey, 7200, campaignData);
      }
    }

    // Step 2: Supabase file path from (public URL se relative path)
    // Example: https://xyz.supabase.co/storage/v1/object/public/uploads/influencers/1234_Tejas/Applycampains/file.png
    const supabaseBaseURL = `${SUPABASE_URL}/storage/v1/object/public/uploads/`;
    const relativeFilePath = filePath.replace(supabaseBaseURL, "");

    // Step 3: Supabase se file delete karo
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
    console.error("deleteApplyNowPortfolioFile error:", error);
    return res.status(500).json({ message: error.message });
  }
};
