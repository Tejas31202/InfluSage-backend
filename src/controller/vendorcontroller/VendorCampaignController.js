import { client } from '../../config/Db.js';
import redis from 'redis';
import fs from 'fs';
import path from 'path';
import { clearScreenDown } from 'readline';

const redisClient = redis.createClient({ url: process.env.REDIS_URL });
redisClient.connect().catch(console.error);

// ---------------- CREATE / UPDATE Campaign Draft ----------------
export const createMyCampaign = async (req, res) => {
  const userId = req.user?.id || req.body.p_userid;
  let username = "user";

  // Prefer JWT payload (if available)
    if (req.user?.firstName || req.user?.lastName) {
      username = `${req.user.firstName || ""}_${req.user.lastName || ""}`.trim();
    }
 
    // Otherwise fallback to body fields (if sent from frontend)
    else if (req.body?.firstName || req.body?.lastName) {
      username = `${req.body.firstName || ""}_${req.body.lastName || ""}`.trim();
    }
 
    // If still missing, fetch from DB
    else {
      const dbUser = await client.query("SELECT firstname, lastname FROM ins.users WHERE id=$1", [userId]);
      if (dbUser.rows[0]) {
        username = `${dbUser.rows[0].firstname || ""}_${dbUser.rows[0].lastname || ""}`.trim() || "user";
      }
    }

  if (!userId) {
    return res.status(400).json({ message: "User ID is required" });
  }

  const tryParseJSON = (value) => {
    try {
      return typeof value === "string" ? JSON.parse(value) : value;
    } catch {
      return value;
    }
  };

  const p_objectivejson = tryParseJSON(req.body.p_objectivejson);
  const p_vendorinfojson = tryParseJSON(req.body.p_vendorinfojson);
  const p_campaignjson = tryParseJSON(req.body.p_campaignjson);
  const p_contenttypejson = tryParseJSON(req.body.p_contenttypejson);
  const p_campaigncategoyjson = tryParseJSON(req.body.p_campaigncategoyjson);

  // ---------------- File Handling ----------------
  let p_campaignfilejson = null;

  // Photo file (single)
  if (req.files?.photo && req.files.photo[0]) {
    const file = req.files.photo[0];
    const ext = path.extname(file.originalname);
    const finalName = `${username}_cp_${Date.now()}${ext}`;

    // Only relative path from src/
    const relativePath = path
      .join("src/uploads/vendor", finalName)
      .replace(/\\/g, "/");

    if (p_campaignjson) {
      p_campaignjson.photopath = relativePath;
    }

    // rename file from multer temp name → our format
    fs.renameSync(file.path, relativePath);
  }
  const redisKey = `getCampaign:${userId}`;

  try {
    let existingData = await redisClient.get(redisKey);
    existingData = existingData ? JSON.parse(existingData) : {};

    //Changes Below For Multiple Files In Edit Options

    // Extract old files array or default to empty array
    const oldFiles = Array.isArray(existingData.p_campaignfilejson)
      ? existingData.p_campaignfilejson
      : [];

    let newFiles = [];

    if (req.files?.Files && req.files.Files.length > 0) {
      newFiles = req.files.Files.map((file,index) => {
        const ext = path.extname(file.originalname);
        const finalName = `${username}_campaign_${Date.now()}_${index}${ext}`;
        const relativePath = path
          .join("src/uploads/vendor", finalName)
          .replace(/\\/g, "/");

        fs.renameSync(file.path, relativePath);

        return { filepath: relativePath };
      });
    }

    // Merge old and new files (if any new files exist)
    const p_campaignfilejson =
      newFiles.length > 0 ? [...oldFiles, ...newFiles] : oldFiles;

    //Changes Below For Multiple Files In Edit Options

    const mergedData = {
      p_objectivejson: p_objectivejson || existingData.p_objectivejson || null,
      p_vendorinfojson:
        p_vendorinfojson || existingData.p_vendorinfojson || null,
      p_campaignjson: p_campaignjson || existingData.p_campaignjson || null,
      p_campaigncategoyjson:
        p_campaigncategoyjson || existingData.p_campaigncategoyjson || null,
      p_campaignfilejson:
        p_campaignfilejson || existingData.p_campaignfilejson || null,
      p_contenttypejson:
        p_contenttypejson || existingData.p_contenttypejson || null,
      is_completed: false,
    };

    await redisClient.set(redisKey, JSON.stringify(mergedData));
    //console.log("===>",mergedData)

    return res.status(200).json({
      status: true,
      message: "Draft stored in Redis successfully",
      campaignParts: mergedData,
      source: "redis",
    });
  } catch (err) {
    console.error("❌ createMyCampaign error:", err);
    return res.status(500).json({ status: false, message: err.message });
  }
};

// ---------------- FINALIZE Campaign ----------------
export const finalizeCampaign = async (req, res) => {
  try {
    const userId = req.user?.id || req.body.p_userid;
    const campaignId = req.body.p_campaignid || null; // ya req.body.campaignid
    const p_statusname = req.body.p_statusname

    if (!userId)
      return res.status(400).json({ message: "User ID is required" });

    const redisKey = `getCampaign:${userId}`;
    const cachedData = await redisClient.get(redisKey);
    if (!cachedData) {
      return res
        .status(404)
        .json({ message: "No campaign data found in Redis to finalize" });
    }

    const campaignData = JSON.parse(cachedData);

    await client.query("BEGIN");
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
          NULL,
          NULL
      )`,
      [
        userId,
        campaignId,
        p_statusname || null,
        JSON.stringify(campaignData.p_objectivejson || {}),
        JSON.stringify(campaignData.p_vendorinfojson || {}),
        JSON.stringify(campaignData.p_campaignjson || {}),
        JSON.stringify(campaignData.p_campaigncategoyjson || {}),
        JSON.stringify(campaignData.p_campaignfilejson || {}),
        JSON.stringify(campaignData.p_contenttypejson || {}),
      ]
    );
   
    await client.query("COMMIT");

    const { p_status, p_message } = result.rows[0] || {};
    if (p_status) {
      await redisClient.del(redisKey); // delete draft
      return res.status(200).json({
        status: p_status,
        message: p_message,
        // campaignId: p_campaignid
      });
    } else {
      return res.status(400).json({
        status: false,
        message: p_message || "Failed to finalize campaign",
      });
    }
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ finalizeCampaign error:", error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

// ---------------- GET CAMPAIGN ----------------
export const getCampaign = async (req, res) => {
  try {
    const userId = req.user?.id || req.query.p_userid;
    const campaignId = req.params.campaignId || "01"; // default draft

    if (!userId) return res.status(400).json({ message: "User ID required" });

    // If draft (campaignId "01"), try Redis cache
    if (campaignId === "01") {
      const redisKey = `getCampaign:${userId}`;
      const cachedData = await redisClient.get(redisKey);
      if (cachedData) {
        return res.status(200).json({
          message: "Draft campaign data from Redis",
          campaignParts: JSON.parse(cachedData),
          source: "redis",
        });
      }

      // Draft not found → return empty
      return res.status(200).json({
        message: "No draft found",
        campaignParts: {},
        source: "redis",
      });
    }

    // For any other campaignId → fetch directly from DB
    const result = await client.query(
      `SELECT * FROM ins.fn_get_campaigndetailsjson($1::BIGINT,$2::BIGINT)`,
      [userId, campaignId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Campaign not found" });
    }

    const fullData = result.rows[0];

    return res.status(200).json({
      message: "Campaign data from DB",
      campaignParts: fullData,
      source: "db",
    });
  } catch (err) {
    console.error("❌ getCampaign error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};


export const deleteCampaignFile = async (req, res) => {
  try {
    const userId = req.user?.id || req.body.userId;
    const filePathToDelete = req.body.filepath;

    if (!userId || !filePathToDelete) {
      return res
        .status(400)
        .json({ message: "userId and filepath are required" });
    }

    // Redis key (ab campaignId nahi hoga)
    const redisKey = `getCampaign:${userId}`;

    // 1 Redis se data fetch
    let campaignData = await redisClient.get(redisKey);
    if (campaignData) {
      campaignData = JSON.parse(campaignData);

      // Remove file from JSON
      if (campaignData.p_campaignfilejson) {
        campaignData.p_campaignfilejson =
          campaignData.p_campaignfilejson.filter(
            (file) => file.filepath !== filePathToDelete
          );

        // Update Redis
        await redisClient.set(redisKey, JSON.stringify(campaignData));
      }
    }

    // 2 Delete file from folder
    const fullPath = path.resolve(filePathToDelete);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }else{
      return res.status(404).json({
        status: false,
        message: "File not found in folder"
      });
    }

    return res.status(200).json({
      status: true,
      message: "File deleted successfully",
      campaignFiles: campaignData?.p_campaignfilejson || [],
    });
  } catch (error) {
    console.error("❌ deleteCampaignFile error:", error);
    return res.status(500).json({ status: false, message: error.message });
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
    return res
      .status(500)
      .json({ message: "Failed to fetch GetCampaignObjectives" });
  }
};

// export const getInfluencerTiers = async (req, res) => {
//   try {
//     const result = await client.query(
//       "SELECT * from ins.fn_get_influencertiers();"
//     );

//     return res.status(200).json({
//       influencerType: result.rows,
//       source: "db",
//     });
//   } catch (error) {
//     console.error("Error fetching GetCampaignObjectives:", error);
//     return res
//       .status(500)
//       .json({ message: "Failed to fetch GetCampaignObjectives" });
//   }
// };

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
    console.error("Error fetching GetCampaignObjectives:", error);
    return res
      .status(500)
      .json({ message: "Failed to fetch GetCampaignObjectives" });
  }
}


export const editCampaign = async (req, res) => {
  try {
    const userId = req.user?.id || req.body.userId;
    const campaignId = req.params.campaignId;

     let username = "user";

  // Prefer JWT payload (if available)
    if (req.user?.firstName || req.user?.lastName) {
      username = `${req.user.firstName || ""}_${req.user.lastName || ""}`.trim();
    }
 
    // Otherwise fallback to body fields (if sent from frontend)
    else if (req.body?.firstName || req.body?.lastName) {
      username = `${req.body.firstName || ""}_${req.body.lastName || ""}`.trim();
    }
 
    // If still missing, fetch from DB
    else {
      const dbUser = await client.query("SELECT firstname, lastname FROM ins.users WHERE id=$1", [userId]);
      if (dbUser.rows[0]) {
        username = `${dbUser.rows[0].firstname || ""}_${dbUser.rows[0].lastname || ""}`.trim() || "user";
      }
    }


    if (!userId || !campaignId) {
      return res.status(400).json({ message: "User ID and Campaign ID are required" });
    }

    const parseIfJson = (data) => {
      if (!data) return {};
      if (typeof data === "string") {
        try { return JSON.parse(data); } 
        catch { return {}; }
      }
      return data;
    };

    const wrapArray = (data) => {
      if (!data) return [];
      if (Array.isArray(data)) return data;
      return [data];
    };

    const cleanArray = (arr) => {
      if (!arr || !Array.isArray(arr)) return [];
      return arr.filter(item => item && Object.keys(item).length);
    };

    // Parse and wrap JSON
    const p_objectivejson = parseIfJson(req.body.p_objectivejson);
    const p_vendorinfojson = parseIfJson(req.body.p_vendorinfojson);
    const p_campaignjson = parseIfJson(req.body.p_campaignjson); 
    const p_campaigncategoyjson = cleanArray(wrapArray(parseIfJson(req.body.p_campaigncategoyjson)));
    const p_contenttypejson = cleanArray(wrapArray(parseIfJson(req.body.p_contenttypejson)));

    // Get existing campaign data
    const existingDataResult = await client.query(
      `SELECT * FROM ins.fn_get_campaigndetailsjson($1::BIGINT, $2::BIGINT)`,
      [userId, campaignId]
    );

    if (!existingDataResult.rows.length) {
      return res.status(404).json({ message: "Campaign not found" });
    }

    const campaignData = existingDataResult.rows[0];

    // console.log("-indb--",campaignData)

    // ---------------- Handle uploaded files ----------------
    const oldFiles = Array.isArray(campaignData.p_campaignfilejson)
      ? campaignData.p_campaignfilejson
      : [];

    let newFiles = [];
    if (req.files?.Files && req.files.Files.length > 0) {
      newFiles = req.files.Files.map((file, index) => {
        const ext = path.extname(file.originalname);
        const finalName = `${username}_campaign_${Date.now()}_${index}${ext}`;
        const relativePath = path.join("src/uploads/vendor", finalName).replace(/\\/g, "/");

        fs.renameSync(file.path, relativePath);
        return { filepath: relativePath };
      });
    }

    // Merge old + new files
    const finalCampaignFiles = newFiles.length > 0 ? [...oldFiles, ...newFiles] : oldFiles;

     // ---------------- Handle campaign photo replacement ----------------
    if (req.files?.photo && req.files.photo[0]) {
      const file = req.files.photo[0];
      const ext = path.extname(file.originalname);
      const finalName = `${username}_cp_${Date.now()}${ext}`;
      const relativePath = path.join("src/uploads/vendor", finalName).replace(/\\/g, "/");

      // ✅ Delete old photo if it exists
      if (campaignData.p_campaignjson?.photopath && fs.existsSync(campaignData.p_campaignjson.photopath)) {
        try {
          fs.unlinkSync(campaignData.p_campaignjson.photopath);
          // console.log("🗑️ Old photo deleted:", campaignData.p_campaignjson.photopath);
        } catch (err) {
          console.warn("⚠️ Could not delete old photo:", err.message);
        }
      }

      // ✅ Move new photo to uploads folder
      fs.renameSync(file.path, relativePath);

      // ✅ Update JSON with new photo path
      if (campaignData.p_campaignjson) {
        campaignData.p_campaignjson.photopath = relativePath;
      } else {
        campaignData.p_campaignjson = { photopath: relativePath };
      }
      // console.log("🆕 New photo uploaded:", relativePath);
    }

    // ---------------- Merge other JSONs ----------------
    const mergeObjects = (oldObj, newObj) => {
      if (!newObj || Object.keys(newObj).length === 0) return oldObj || {};
      return { ...oldObj, ...newObj };
    };

    const mergedData = {
      p_objectivejson: mergeObjects(campaignData.p_objectivejson, p_objectivejson),
      p_vendorinfojson: mergeObjects(campaignData.p_vendorinfojson, p_vendorinfojson),
      p_campaignjson: Object.keys(p_campaignjson).length 
      ? mergeObjects(campaignData.p_campaignjson, p_campaignjson)
      : campaignData.p_campaignjson || {},
      p_campaigncategoyjson: p_campaigncategoyjson.length ? p_campaigncategoyjson : campaignData.p_campaigncategoyjson || [],
      p_campaignfilejson: finalCampaignFiles,
      p_contenttypejson: p_contenttypejson.length ? p_contenttypejson : campaignData.p_contenttypejson || [],
    };

    // console.log("merge-->",mergedData.p_campaignjson)
    // Call the stored procedure
    const result = await client.query(
      `CALL ins.usp_upsert_campaigndetails(
        $1::BIGINT,
        $2::BIGINT,
        $3::JSON,
        $4::JSON,
        $5::JSON,
        $6::JSON,
        $7::JSON,
        $8::JSON,
        NULL,
        NULL
      )`,
      [
        userId,
        campaignId,
        JSON.stringify(mergedData.p_objectivejson),
        JSON.stringify(mergedData.p_vendorinfojson),
        JSON.stringify(mergedData.p_campaignjson),
        JSON.stringify(mergedData.p_campaigncategoyjson),
        JSON.stringify(mergedData.p_campaignfilejson),
        JSON.stringify(mergedData.p_contenttypejson),
      ]
    );
   
    const { p_status, p_message } = result.rows[0] || {};
    if (p_status) {
      return res.status(200).json({ success: true, message: p_message ,source: "db"});
    } else {
      return res.status(400).json({ success: false, message: p_message });
    }

  } catch (error) {
    console.error("❌ Error updating campaign:", error);
    return res.status(500).json({
      success: false,
      message: "Error updating campaign",
      error: error.message,
    });
  }
};

export const upsertCampaign = async (req, res) => {
  try {
    const p_userid = req.user?.id || req.body.p_userid;
    const campaignId = req.body.campaignId || null;
    let username = "user";
    if (!p_userid) {

      
      return res.status(400).json({ message: "User ID is required" });
    }

    // 🧩 Get username from JWT, body, or DB
    if (req.user?.firstName || req.user?.lastName) {
      username = `${req.user.firstName || ""}_${req.user.lastName || ""}`.trim();
    } else if (req.body?.firstName || req.body?.lastName) {
      username = `${req.body.firstName || ""}_${req.body.lastName || ""}`.trim();
    } else {
      const dbUser = await client.query(
        "SELECT firstname, lastname FROM ins.users WHERE id=$1",
        [p_userid]
      );
      if (dbUser.rows[0]) {
        username = `${dbUser.rows[0].firstname || ""}_${dbUser.rows[0].lastname || ""}`.trim() || "user";
      }
    }
    // 🧩 Helpers
    const parseIfJson = (data) => {
      if (!data) return {};
      if (typeof data === "string") {
        try { return JSON.parse(data); } catch { return {}; }
      }
      return data;
    };

    const cleanArray = (arr) => {
      if (!arr || !Array.isArray(arr)) return [];
      return arr.filter((item) => item && Object.keys(item).length);
    };

    // 🧩 Parse JSON inputs
    const p_objectivejson = parseIfJson(req.body.p_objectivejson);
    const p_vendorinfojson = parseIfJson(req.body.p_vendorinfojson);
    const p_campaignjson = parseIfJson(req.body.p_campaignjson);
    const p_campaigncategoyjson = cleanArray(parseIfJson(req.body.p_campaigncategoyjson));
    const p_campaignfilejson = cleanArray(parseIfJson(req.body.p_campaignfilejson));
    const p_contenttypejson = cleanArray(parseIfJson(req.body.p_contenttypejson));

    // ---------------- FILE HANDLING ----------------
    let campaignPhotoPath = p_campaignjson?.photopath || null;
    let campaignFiles = [];

    // Photo upload
    if (req.files?.photo && req.files.photo[0]) {
      const photo = req.files.photo[0];
      const ext = path.extname(photo.originalname);
      const finalName = `${username}_cp_${Date.now()}${ext}`;
      const relativePath = path.join("src/uploads/vendor", finalName).replace(/\\/g, "/");
      fs.renameSync(photo.path, relativePath);
      campaignPhotoPath = relativePath;
      if (p_campaignjson) p_campaignjson.photopath = relativePath;
    }

    // Multiple files upload
    if (req.files?.Files && req.files.Files.length > 0) {
      campaignFiles = req.files.Files.map((file, index) => {
        const ext = path.extname(file.originalname);
        const finalName = `${username}_campaign_${Date.now()}_${index}${ext}`;
        const relativePath = 
        path.join("src/uploads/vendor", finalName).replace(/\\/g, "/");
        fs.renameSync(file.path, relativePath);
        return { filepath: relativePath };
      });
    }

    // ---------------- REDIS (DRAFT) ----------------
    const redisKey = `getCampaign:${p_userid}`;

    if (!campaignId) {
      // Read existing draft if exists
      let existingDraft = {};
      const cachedData = await redisClient.get(redisKey);
      if (cachedData) {
        existingDraft = JSON.parse(cachedData);
      }

      // Merge old draft with new step
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
        is_completed: false,
      };

      await redisClient.set(redisKey, JSON.stringify(draftData));

      return res.status(200).json({
        status: true,
        message: "Draft stored in Redis successfully",
        campaignParts: draftData,
        source: "redis",
      });
    }

    // ---------------- DB UPSERT ----------------
    // Fetch existing data to merge
    const existingDataResult = await client.query(
      `SELECT * FROM ins.fn_get_campaigndetailsjson($1::BIGINT, $2::BIGINT)`,
      [p_userid, campaignId]
    );

    const existingData = existingDataResult.rows[0] || {};

    const mergeObjects = (oldObj, newObj) => ({ ...oldObj, ...newObj });

    const finalData = {
      p_objectivejson: mergeObjects(existingData.p_objectivejson || {}, p_objectivejson),
      p_vendorinfojson: mergeObjects(existingData.p_vendorinfojson || {}, p_vendorinfojson),
      p_campaignjson: mergeObjects(existingData.p_campaignjson || {}, p_campaignjson),
      p_campaigncategoyjson: p_campaigncategoyjson.length
        ? p_campaigncategoyjson
        : existingData.p_campaigncategoyjson || [],
      p_campaignfilejson:
        (p_campaignfilejson.length || campaignFiles.length)
          ? [...(existingData.p_campaignfilejson || []), ...p_campaignfilejson, ...campaignFiles]
          : existingData.p_campaignfilejson || [],
      p_contenttypejson: p_contenttypejson.length
        ? p_contenttypejson
        : existingData.p_contenttypejson || [],
    };

    // Call DB procedure
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
        NULL,       
        NULL  
      )`,
    [
    p_userid,
    campaignId,
    finalData.p_statusname || null,
    JSON.stringify(finalData.p_objectivejson),
    JSON.stringify(finalData.p_vendorinfojson),
    JSON.stringify(finalData.p_campaignjson),
    JSON.stringify(finalData.p_campaigncategoyjson),
    JSON.stringify(finalData.p_campaignfilejson),
    JSON.stringify(finalData.p_contenttypejson),
  ]
);

    const { p_status, p_message } = result.rows[0] || {};

    return res.status(p_status ? 200 : 400).json({
      success: p_status,
      message: p_message,
      source: "db",
    });

  } catch (err) {
    console.error("❌ upsertCampaign error:", err);
    return res.status(500).json({
      success: false,
      message: "Error processing campaign",
      error: err.message,
    });
  }
};