import { client } from "../../config/db.js";
import redis from "redis";
import fs from "fs";
import path from "path";

const redisClient = redis.createClient({ url: process.env.REDIS_URL });
redisClient.connect().catch(console.error);

// ---------------- CREATE / DRAFT CAMPAIGN ----------------
export const createMyCampaign = async (req, res) => {
  const userId = req.user?.id || req.body.p_userid;
  const username = req.user?.name || "user";
  
  if (!userId) return res.status(400).json({ message: "User ID is required" });

  // Extract incoming JSONs safely
  const tryParseJSON = (value) => {
    try {
      return typeof value === "string" ? JSON.parse(value) : value;
    } catch (e) {
      return value;
    }
  };

  const p_objectivejson   = tryParseJSON(req.body.p_objectivejson);
  const p_vendorinfojson  = tryParseJSON(req.body.p_vendorinfojson);
  const p_campaignjson    = tryParseJSON(req.body.p_campaignjson);
  const p_contenttypejson = tryParseJSON(req.body.p_contenttypejson);

  // Handle file uploads
  let p_campaignfilejson = null;

  // Multiple files first
  if (req.files && req.files.length > 0) {
    p_campaignfilejson = req.files.map((file) => {
      const newFileName = `${username}_campaign_${Date.now()}${path.extname(file.originalname)}`;
      const newPath = path.join("src/uploads/vendor", newFileName);
      fs.renameSync(file.path, newPath);
      return { filepath: newPath.replace(/\\/g, "/") };
    });
  } else if (req.file) {
    // Single file fallback
    const file = req.file;
    const newFileName = `${username}_up_${Date.now()}${path.extname(file.originalname)}`;
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
      p_vendorinfojson: p_vendorinfojson || existingData.p_vendorinfojson || null,
      p_campaignjson: p_campaignjson || existingData.p_campaignjson || null,
      p_campaignfilejson: p_campaignfilejson || existingData.p_campaignfilejson || null,
      p_contenttypejson: p_contenttypejson || existingData.p_contenttypejson || null,
      is_completed: false
    };

    // Store in Redis
    await redisClient.set(redisKey, JSON.stringify(mergedData));

    // Check if all parts present
    const allPartsPresent =
      mergedData.p_objectivejson &&
      mergedData.p_vendorinfojson &&
      mergedData.p_campaignjson &&
      mergedData.p_campaignfilejson &&
      mergedData.p_contenttypejson;

    // Partial save → just return draft
    if (!allPartsPresent) {
      return res.status(200).json({
        status: false,
        message: "Partial data stored in Redis. Complete all steps to save to DB.",
        campaignParts: mergedData,
        source: "redis",
      });
    }

    // All complete → call SP
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
        req.body.campaignid || null,
        JSON.stringify(mergedData.p_objectivejson),
        JSON.stringify(mergedData.p_vendorinfojson),
        JSON.stringify(mergedData.p_campaignjson),
        JSON.stringify(mergedData.p_campaignfilejson),
        JSON.stringify(mergedData.p_contenttypejson)
      ]
    );
    await client.query("COMMIT");

    // Clear draft Redis
    await redisClient.del(redisKey);

    const { p_status, p_message } = result.rows[0] || {};
    return res.status(200).json({
      status: p_status,
      message: p_message,
      campaignParts: mergedData,
      source: "db",
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ createMyCampaign error:", err);
    return res.status(500).json({ status: false, message: err.message });
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
        message: campaignId === "01" ? "Draft campaign data from Redis" : "Campaign data from Redis",
        campaignParts: JSON.parse(cachedData),
        source: "redis"
      });
    }

    // Draft not found → return empty
    if (campaignId === "01") {
      return res.status(200).json({
        message: "No draft found",
        campaignParts: {},
        source: "redis"
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
      source: "db"
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
    const filePathToDelete = req.body.filepath; // frontend se path milega

    if (!userId || !campaignId || !filePathToDelete)
      return res
        .status(400)
        .json({ message: "userId, campaignId and filepath are required" });

    // Redis key
    const redisKey = `getCampaign:${userId}:${campaignId}`;

    // 1 Redis se data fetch
    let campaignData = await redisClient.get(redisKey);
    if (campaignData) {
      campaignData = JSON.parse(campaignData);

      // Remove file from JSON
      if (campaignData.p_campaignfilejson) {
        campaignData.p_campaignfilejson = campaignData.p_campaignfilejson.filter(
          (file) => file.filepath !== filePathToDelete
        );

        // Update Redis
        await redisClient.set(redisKey, JSON.stringify(campaignData));
      }
    }

    // 2 Delete file from folder
    const fullPath = path.resolve(filePathToDelete); // absolute path
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
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