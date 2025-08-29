import { client } from "../../config/db.js";
import { deleteFileFromRedis } from "../../utils/DeleteFiles.js";
import redis from "redis";
import fs from "fs";
import path from "path";

const redisClient = redis.createClient({ url: process.env.REDIS_URL });
redisClient.connect().catch(console.error);

// ---------------- CREATE / UPDATE Campaign Draft ----------------
export const createMyCampaign = async (req, res) => {
  const userId = req.user?.id || req.body.p_userid;
  const username = req.user?.name || "user";

  if (!userId) return res.status(400).json({ message: "User ID is required" });

  // Safely parse incoming JSONs
  const tryParseJSON = (value) => {
    try {
      return typeof value === "string" ? JSON.parse(value) : value;
    } catch (e) {
      return value;
    }
  };

  const p_objectivejson = tryParseJSON(req.body.p_objectivejson);
  const p_vendorinfojson = tryParseJSON(req.body.p_vendorinfojson);
  const p_campaignjson = tryParseJSON(req.body.p_campaignjson);
  const p_contenttypejson = tryParseJSON(req.body.p_contenttypejson);

  // ---------------- File Handling ----------------
  let p_campaignfilejson = null;

  if (req.files && req.files.length > 0) {
    p_campaignfilejson = req.files.map((file) => {
      const newFileName = `${username}_campaign_${Date.now()}${path.extname(
        file.originalname
      )}`;
      const newPath = path.join("src/uploads/vendor", newFileName);

      fs.renameSync(file.path, newPath);
      return { filepath: newPath.replace(/\\/g, "/") };
    });
  } else if (req.file) {
    const file = req.file;
    const newFileName = `${username}_up_${Date.now()}${path.extname(
      file.originalname
    )}`;
    const newPath = path.join("src/uploads/vendor", newFileName);
    fs.renameSync(file.path, newPath);
    p_campaignfilejson = [{ filepath: newPath.replace(/\\/g, "/") }];
  }

  const redisKey = `getCampaign:${userId}`; // consistent draft key
  console.log("👉 Redis Key:", redisKey);

  try {
    // Existing draft in Redis
    let existingData = await redisClient.get(redisKey);
    existingData = existingData ? JSON.parse(existingData) : {};

    // Merge new + existing data
    const mergedData = {
      p_objectivejson: p_objectivejson || existingData.p_objectivejson || null,
      p_vendorinfojson:
        p_vendorinfojson || existingData.p_vendorinfojson || null,
      p_campaignjson: p_campaignjson || existingData.p_campaignjson || null,
      p_campaignfilejson:
        p_campaignfilejson || existingData.p_campaignfilejson || null,
      p_contenttypejson:
        p_contenttypejson || existingData.p_contenttypejson || null,
      is_completed: false,
    };

    // Store draft in Redis
    // ✅ Redis me draft store karo
    await redisClient.set(redisKey, JSON.stringify(mergedData));

    return res.status(200).json({
      status: true,
      message: "Draft stored in Redis successfully",
      campaignParts: mergedData,
      source: "redis",
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ createMyCampaign error:", err);
    return res.status(500).json({ status: false, message: err.message });
  }
};

// ---------------- FINALIZE Campaign ----------------
export const finalizeCampaign = async (req, res) => {
  try {
    const userId = req.user?.id || req.body.p_userid;
    const campaignId = req.body.p_campaignid || null; // ya req.body.campaignid

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
      `CALL ins.sp_upsert_campaigndetails(
          $1::BIGINT,
          $2::BIGINT,
          $3::JSON,
          $4::JSON,
          $5::JSON,
          $6::JSON,
          $7::JSON,
          NULL,
          NULL
      )`,
      [
        userId,
        campaignId,
        JSON.stringify(campaignData.p_objectivejson || {}),
        JSON.stringify(campaignData.p_vendorinfojson || {}),
        JSON.stringify(campaignData.p_campaignjson || {}),
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

    let redisKey;
    if (campaignId === "01") {
      // Draft mode → Redis key without campaignId
      redisKey = `getCampaign:${userId}`;
    } else {
      // Actual campaign → Redis key with campaignId
      redisKey = `getCampaign:${userId}:${campaignId}`;
    }

    console.log("👉 Redis Key:", redisKey);

    // Check Redis
    const cachedData = await redisClient.get(redisKey);
    if (cachedData) {
      return res.status(200).json({
        message:
          campaignId === "01"
            ? "Draft campaign data from Redis"
            : "Campaign data from Redis",
        campaignParts: JSON.parse(cachedData),
        source: "redis",
      });
    }

    // Draft not found → return empty
    if (campaignId === "01") {
      return res.status(200).json({
        message: "No draft found",
        campaignParts: {},
        source: "redis",
      });
    }

    // Fetch actual campaign from DB
    const result = await client.query(
      `SELECT * FROM ins.fn_get_campaigndetailsjson($1::BIGINT,$2::BIGINT)`,
      [userId, campaignId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Campaign not found" });
    }

    const fullData = result.rows[0];
    // Cache in Redis 120s
    await redisClient.setEx(redisKey, 120, JSON.stringify(fullData));

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
    const campaignId = req.body.campaignId;
    const filePathToDelete = req.body.filepath;

    if (!userId || !campaignId || !filePathToDelete) {
      return res.status(400).json({
        message: "userId, campaignId and filepath are required",
      });
    }

    const redisKey = `getCampaign:${userId}:${campaignId}`;
    const updatedData = await deleteFileFromRedis(
      redisKey,
      "p_campaignfilejson",
      filePathToDelete,
      "vendor" // 👈 vendor folder
    );

    if (!updatedData) {
      return res
        .status(404)
        .json({ status: false, message: "Campaign draft not found in Redis" });
    }

    return res.status(200).json({
      status: true,
      message: "Campaign file deleted successfully",
      campaignFiles: updatedData.p_campaignfilejson || [],
    });
  } catch (error) {
    console.error("❌ deleteCampaignFile error:", error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

export const GetCampaignObjectives = async (req, res) => {
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

export const GetLanguages = async (req, res) => {
  try {
    const result = await client.query("SELECT * FROM ins.fn_get_languages();");

    return res.status(200).json({
      languages: result.rows,
      source: "db",
    });
  } catch (error) {
    console.error("Error fetching languages:", error);
    return res.status(500).json({ message: "Failed to fetch languages" });
  }
};


export const GetInfluencerTiers = async(req,res)=>{
  
   try {
    const result = await client.query(
      "SELECT * from ins.fn_get_influencertiers();"
    );

    return res.status(200).json({
      influencerType: result.rows,
      source: "db",
    });
  } catch (error) {
    console.error("Error fetching GetCampaignObjectives:", error);
    return res
      .status(500)
      .json({ message: "Failed to fetch GetCampaignObjectives" });
  }
}

export const GetGender=async(req,res)=>{
  
  try {
    const result = await client.query(
      "SELECT * from ins.fn_get_genders();"
    );

    return res.status(200).json({
      genders: result.rows,
      source: "db",
    });
  } catch (error) {
    console.error("Error fetching GetCampaignObjectives:", error);
    return res
      .status(500)
      .json({ message: "Failed to fetch GetCampaignObjectives" });
  }
}