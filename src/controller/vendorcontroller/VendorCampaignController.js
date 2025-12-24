import { client } from '../../config/Db.js';
import { createClient } from "@supabase/supabase-js";
import Redis from '../../utils/RedisWrapper.js';
import path from 'path';
import fs from 'fs';
import fsPromises from "fs/promises";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// const Redis = redis.createClient({ url: process.env.REDIS_URL });
// Redis.connect().catch(console.error);

// ---------------- FINALIZE Campaign ----------------
export const finalizeCampaign = async (req, res) => {
  try {
    const userId = req.user?.id || req.body.p_userid;
    const campaignId = req.body.p_campaignid || null;
    const p_statusname = req.body.p_statusname ;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // Redis key
    const redisKey = campaignId
      ? `getCampaign:${userId}:${campaignId}`
      : `getCampaign:${userId}`;

    const cachedData = await Redis.get(redisKey);
    if (!cachedData) {
      return res.status(404).json({
      message: "No campaign data found in Redis to finalize",
      source: "redis",
      });
    }

    const campaignData = cachedData;

    // --------------- BEGIN DB TRANSACTION ---------------
    await client.query("BEGIN");
    await client.query(
      "SELECT set_config('app.current_user_id', $1, true)",
      [String(userId)]
    );
    const result = await client.query(
      `CALL ins.usp_upsert_campaigndetails(
        $1::BIGINT,
        $2::BIGINT,
        $3::VARCHAR,
        $4::JSON,
        $5::JSON,
        $6::JSON,
        $7::JSON,
        $8::JSON,
        $9::JSON,
        $10::smallint,
        $11::TEXT
      )`,
      [
        userId,
        campaignId,
        p_statusname,
        JSON.stringify(campaignData.p_objectivejson || {}),
        JSON.stringify(campaignData.p_vendorinfojson || {}),
        JSON.stringify(campaignData.p_campaignjson || {}),
        JSON.stringify(campaignData.p_campaigncategoyjson || {}),
        JSON.stringify(campaignData.p_campaignfilejson || {}),
        JSON.stringify(campaignData.p_contenttypejson || {}),
        null,
        null
      ]
    );

    console.log("DB finalize result:", result.rows[0]);

    await client.query("COMMIT");

    const row = result.rows[0] || {};
    const p_status = Number(row.p_status);
    const p_message = row.p_message;
    const finalCampaignId = row.p_campaignid;

    // ----------------- HANDLE p_status -----------------
    if (p_status === 1) {
      // ------------------- FILE MOVE LOGIC -------------------
      const baseTempFolder = `Vendor/${userId}/Campaigns/_temp`;
      const finalFolderBase = `Vendor/${userId}/Campaigns/${finalCampaignId}`;
      const finalPhotoFolder = `${finalFolderBase}/campaign_profile`;
      const finalPortfolioFolder = `${finalFolderBase}/campaign_portfolio`;

      // Move photo files
      const { data: tempPhotos } = await supabase.storage
        .from(process.env.SUPABASE_BUCKET)
        .list(`${baseTempFolder}/campaign_profile`);
      if (tempPhotos?.length > 0) {
        for (const file of tempPhotos) {
          const oldPath = `${baseTempFolder}/campaign_profile/${file.name}`;
          const newPath = `${finalPhotoFolder}/${file.name}`;

          const { data: fileData, error: downloadErr } = await supabase.storage
            .from(process.env.SUPABASE_BUCKET)
            .download(oldPath);

          if (!downloadErr) {
            await supabase.storage.from(process.env.SUPABASE_BUCKET).upload(newPath, fileData, { upsert: true });
            await supabase.storage.from(process.env.SUPABASE_BUCKET).remove([oldPath]);
          }
        }
      }

      // Move portfolio files
      const { data: tempPortfolios } = await supabase.storage
        .from(process.env.SUPABASE_BUCKET)
        .list(`${baseTempFolder}/campaign_portfolio`);
      if (tempPortfolios?.length > 0) {
        for (const file of tempPortfolios) {
          const oldPath = `${baseTempFolder}/campaign_portfolio/${file.name}`;
          const newPath = `${finalPortfolioFolder}/${file.name}`;

          const { data: fileData, error: downloadErr } = await supabase.storage
            .from(process.env.SUPABASE_BUCKET)
            .download(oldPath);

          if (!downloadErr) {
            await supabase.storage.from(process.env.SUPABASE_BUCKET).upload(newPath, fileData, { upsert: true });
            await supabase.storage.from(process.env.SUPABASE_BUCKET).remove([oldPath]);
          }
        }
      }

      // Clean up temp folders and Redis cache
      await supabase.storage.from(process.env.SUPABASE_BUCKET).remove([
        `${baseTempFolder}/campaign_profile`,
        `${baseTempFolder}/campaign_portfolio`,
      ]);

      await Redis.del(redisKey);
      return res.status(200).json({
        status: true,
        message: p_message || "Campaign finalized successfully",
        campaignId: finalCampaignId,
        source: "db",
      });
    } 
    else if (p_status === 0) {
      return res.status(400).json({
        status: false,
        message: p_message || "Validation failed",
        source: "db",
      });
    } 
    else if (p_status === -1) {
      return res.status(500).json({
        status: false,
        message: p_message || "Something went wrong while finalizing campaign",
      });
    } 
    else {
      return res.status(500).json({
        status: false,
        message: "Unexpected database response",
      });
    }
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("finalizeCampaign error:", error);
    return res.status(500).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};
// ---------------- GET CAMPAIGN ----------------
export const getCampaign = async (req, res) => {
  try {
    const userId = req.user?.id || req.query.p_userid;
    const campaignId = req.params.campaignId || "01";

    if (!userId)
      return res.status(400).json({ message: "User ID required" });

    const redisKey =
      campaignId === "01"
        ? `getCampaign:${userId}`
        : `getCampaign:${userId}:${campaignId}`;

    if (campaignId === "01") {
      const cachedData = await Redis.get(redisKey);
      if (cachedData) {
        return res.status(200).json({
          message: "Draft campaign from Redis",
          campaignParts: cachedData,
          source: "redis",
        });
      }

      return res.status(200).json({
        message: "No draft found",
        campaignParts: {},
        source: "empty",
      });
    }

    const cachedEditData = await Redis.get(redisKey);
    if (cachedEditData) {
      return res.status(200).json({
        message: "Campaign data from Redis",
        campaignParts:cachedEditData,
        source: "redis",
      });
    }
    const result = await client.query(
      `SELECT * FROM ins.fn_get_campaigndetailsjson($1::BIGINT, $2::BIGINT)`,
      [userId, campaignId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Campaign not found" });
    }

    const fullData = result.rows[0];

    // Cache DB data in Redis for next time 1h->3600 sec
    await Redis.setEx(redisKey, 3600, fullData);

    return res.status(200).json({
      message: "Campaign data from DB",
      campaignParts: fullData,
      source: "db",
    });
  } catch (error) {
    console.error("error in getCampaign:", error);
    return res.status(500).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};

export const deleteCampaignFile = async (req, res) => {
  try {
    const userId = req.user?.id || req.body.userId;
    const campaignId = req.body.campaignId || null; // Pass this from frontend
    const filePathToDelete = req.body.filepath; // Public Supabase URL
    const bucketName =process.env.SUPABASE_BUCKET

    if (!userId || !filePathToDelete) {
      return res.status(400).json({
        status: false,
        message: "userId and filepath are required",
      });
    }

    // ---------------- 1 Build Redis Key ----------------
    const redisKey = campaignId
      ? `getCampaign:${userId}:${campaignId}`
      : `getCampaign:${userId}`;

    // ---------------- 2 Update Redis ----------------
    let campaignData = await Redis.get(redisKey);
    let updatedFiles = [];

    if (campaignData && Array.isArray(campaignData.p_campaignfilejson)) {
      campaignData.p_campaignfilejson = campaignData.p_campaignfilejson.filter(file => {
        const redisFileName = file.filepath.split("/").pop();
        const requestFileName = filePathToDelete.split("/").pop();
        return redisFileName !== requestFileName;
      });

      updatedFiles = campaignData.p_campaignfilejson;
      await Redis.setEx(redisKey, 3600, campaignData); // update Redis
    }

    // ---------------- 2️⃣ Convert public URL to relative path ----------------
    const supabaseFilePath = filePathToDelete
      .split(`/storage/v1/object/public/${bucketName}/`)[1]
      ?.trim();

    if (!supabaseFilePath) {
      return res.status(400).json({
        status: false,
        message: "Invalid Supabase file path format",
      });
    }

    // ---------------- 3️⃣ Delete from Supabase Storage ----------------
    const { error: deleteError } = await supabase.storage
      .from(bucketName)
      .remove([supabaseFilePath]);

    if (deleteError) {
      console.error("❌ Supabase delete error:", deleteError.message);
      return res.status(500).json({
        status: false,
        message: "Error deleting file from Supabase",
        error: deleteError.message,
      });
    }

    return res.status(200).json({
      status: true,
      message: "File deleted successfully from Supabase and Redis",
      deletedFile: supabaseFilePath,
      campaignFiles: campaignData?.p_campaignfilejson || [],
    });
  } catch (error) {
    console.error("error in deleteCampaignFile:",error);
    return res.status(500).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};

export const getCampaignObjectives = async (req, res) => {
  try {
    const result = await client.query(
      "SELECT * from ins.fn_get_campaignobjectives()"
    );

    return res.status(200).json({
      objectives: result.rows,
      source: "db",
    });
  } catch (error) {
    console.error("Error fetching GetCampaignObjectives:", error);
    return res.status(500).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};

export const getProvidorContentTypes = async (req, res) => {
  try {
    const result = await client.query(
      "SELECT * from ins.fn_get_providercontenttypes();"
    );

    return res.status(200).json({
      providorType: result.rows,
      source: "db",
    });
  } catch (error) {
    console.error("Error fetching getProvidorContentTypes:", error);
    return res.status(500).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
}

export const upsertCampaign = async (req, res) => {
  try {
    const p_userid = req.user?.id || req.body.p_userid;
    const campaignId = req.body.campaignId || null;
    const isFinalSubmit = req.body.isFinalSubmit || false;
    const p_statusname = req.body.p_statusname ||null;

    if (!p_userid)
      return res.status(400).json({ message: "User ID is required" });

    // ---------------- HELPERS ----------------
    const parseIfJson = (data) => {
      try {
        return data ? JSON.parse(data) : {};
      } catch {
        return {};
      }
    };
    const cleanArray = (arr) => (Array.isArray(arr) ? arr.filter(Boolean) : []);

    // ---------------- PARSE JSON FIELDS ----------------
    const p_objectivejson = parseIfJson(req.body.p_objectivejson);
    const p_vendorinfojson = parseIfJson(req.body.p_vendorinfojson);
    const p_campaignjson = parseIfJson(req.body.p_campaignjson);
    const p_campaigncategoyjson = cleanArray(req.body.p_campaigncategoyjson);
    const p_campaignfilejson = cleanArray(req.body.p_campaignfilejson);
    const p_contenttypejson = cleanArray(req.body.p_contenttypejson);

    // ---------------- TEMP FOLDERS ----------------
    const baseTempFolder = `Vendor/${p_userid}/Campaigns/_temp`;
    const tempPhotoFolder = `${baseTempFolder}/campaign_profile`;
    const tempPortfolioFolder = `${baseTempFolder}/campaign_portfolio`;

    let campaignFiles = [];

    // ---------------- UPLOAD MAIN PHOTO ----------------
    if (req.files?.photo?.[0]) {
      const file = req.files.photo[0];
      const newFileName = file.originalname;
      const tempPhotoPath = `${tempPhotoFolder}/${newFileName}`;

      const { error } = await supabase.storage.from(process.env.SUPABASE_BUCKET).upload(
        tempPhotoPath,
        file.buffer,
        { contentType: file.mimetype, upsert: true }
      );
      if (error) throw new Error(`Photo upload failed: ${error.message}`);

      // // Only store filename in DB
      // p_campaignjson.photopath = newFileName;
      const { data: publicData } = supabase.storage.from(process.env.SUPABASE_BUCKET).getPublicUrl(tempPhotoPath);
        p_campaignjson.photopath = publicData.publicUrl; // store full URL for UI
    }

    // ---------------- UPLOAD PORTFOLIO FILES ----------------
    if (req.files?.Files?.length > 0) {
      for (const file of req.files.Files) {
        const newFileName = file.originalname;
        const tempPortfolioPath = `${tempPortfolioFolder}/${newFileName}`;

        const { error } = await supabase.storage.from(process.env.SUPABASE_BUCKET).upload(
          tempPortfolioPath,
          file.buffer,
          { contentType: file.mimetype, upsert: true }
        );
        if (error) console.warn("⚠️ File upload failed:", error.message);

        // // Only store filename in DB
        // campaignFiles.push({ filepath: newFileName });
        const { data: publicData } = supabase.storage.from(process.env.SUPABASE_BUCKET).getPublicUrl(tempPortfolioPath);
        campaignFiles.push({filepath: publicData.publicUrl });
      }
    }

    // ---------------- REDIS DRAFT HANDLING ----------------
    const redisKey = `getCampaign:${p_userid}${campaignId ? `:${campaignId}` : ""}`;

    // GET
    // const cached = await Redis.get(redisKey);
    let existingDraft = {};
    const cached = await Redis.get(redisKey);
    if (cached) existingDraft = JSON.parse(cached);

    const draftData = {
      p_objectivejson: { ...(existingDraft.p_objectivejson || {}), ...p_objectivejson },
      p_vendorinfojson: { ...(existingDraft.p_vendorinfojson || {}), ...p_vendorinfojson },
      p_campaignjson: { ...(existingDraft.p_campaignjson || {}), ...p_campaignjson },
      p_campaigncategoyjson: p_campaigncategoyjson.length
        ? p_campaigncategoyjson
        : existingDraft.p_campaigncategoyjson || [],
      p_contenttypejson: p_contenttypejson.length
        ? p_contenttypejson
        : existingDraft.p_contenttypejson || [],
      p_campaignfilejson: [
        ...(existingDraft.p_campaignfilejson || []),
        ...(p_campaignfilejson || []),
        ...(campaignFiles || []),
      ],
      updated_at: new Date(),
    };
    //Redis store data for 24h -> 86400 sec
    await Redis.setEx(redisKey, 86400, draftData);


    // ---------------- DRAFT SAVE ONLY ----------------
    if (!isFinalSubmit) {
      return res.status(200).json({
        status: true,
        message: "Draft stored in Redis successfully",
        campaignParts: draftData,
        source: "redis",
      });
    }
    
    // DB Call for edit only startdate and enddate 

    await client.query("BEGIN");
    await client.query(
      "SELECT set_config('app.current_user_id', $1, true)",
      [String(p_userid)]
    );
    const result = await client.query(
      `CALL ins.usp_upsert_campaigndetails(
        $1::BIGINT, 
        $2::BIGINT, 
        $3::varchar, 
        $4::JSON, 
        $5::JSON, 
        $6::JSON, 
        $7::JSON, 
        $8::JSON, 
        $9::JSON,
        $10::smallint,
        $11::TEXT
      )`,
      [
        p_userid,
        campaignId,
        p_statusname,
        p_objectivejson||null ,
        p_vendorinfojson||null ,
        req.body.p_campaignjson,
        p_campaigncategoyjson||null,
        p_campaignfilejson||null,
        p_contenttypejson||null,
        null,
        null
      ]
    );
    await client.query("COMMIT");
    const row = result.rows[0] || {};
    const p_status = Number(row.p_status);
    const p_message = row.p_message;
    const finalCampaignId = row.p_campaignid;

    if (p_status === 1) {
      return res.status(200).json({
        status: true,
        message: p_message || "Campaign saved successfully",
        campaignId: finalCampaignId,
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
        message: "Something went wrong while saving campaign",
      });
    } else {
      return res.status(500).json({
        status: false,
        message: "Unexpected database response",
      });
    }
  } catch (error) {
    console.error("error in upsertCampaign:", error);
    return res.status(500).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};