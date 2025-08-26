import { client } from "../../config/db.js";
import redis from "redis";
import fs from "fs";
import path from "path";

const redisClient = redis.createClient({ url: process.env.REDIS_URL });
redisClient.connect().catch(console.error);

export const createMyCampaign = async (req, res) => {
  const userId = req.user?.id || req.body.p_userid;

  const username =req.user.name 
  console.log("username===>",username)
  const {
    campaignid,
    p_objectivejson,
    p_vendorinfojson,
    p_campaignjson,
    p_contenttypejson
  } = req.body;

  // multer files se path extract
  let p_campaignfilejson = null;
    if (req.file) {
    const file = req.file;
    const newFileName = `${username}_up_${Date.now()}${path.extname(
      file.originalname
    )}`;
    const newPath = path.join("src/uploads/vendor", newFileName);

    // move file
    fs.renameSync(file.path, newPath);

    const photoPath = newPath.replace(/\\/g, "/"); // normalize slashes
    p_campaignfilejson = [{ filepath: photoPath }];
  }

  // ✅ Case 2: Multiple files (req.files)
  if (req.files && req.files.length > 0) {
    p_campaignfilejson = req.files.map((file) => {
      const newFileName = `${username}_campaign_${Date.now()}${path.extname(
        file.originalname
      )}`;
      const newPath = path.join("src/uploads/vendor", newFileName);
      fs.renameSync(file.path, newPath);
      return { filepath: newPath.replace(/\\/g, "/") };
    });
  }

  const redisKey = `getCampaign:${userId}:${campaignid || "temp"}`;
  console.log("👉 Redis Key:", redisKey);

  try {
    if (!userId) return res.status(400).json({ message: "User ID is required" });

    // Redis existing data
    let existingData = await redisClient.get(redisKey);
    existingData = existingData ? JSON.parse(existingData) : {};

    // Before merging JSONs
function tryParseJSON(value) {
  try {
    return typeof value === "string" ? JSON.parse(value) : value;
  } catch (e) {
    return value; // agar parse fail ho to raw string hi rahe
  }
}

const p_objectivejson   = tryParseJSON(req.body.p_objectivejson);
const p_vendorinfojson  = tryParseJSON(req.body.p_vendorinfojson);
const p_campaignjson    = tryParseJSON(req.body.p_campaignjson);
const p_contenttypejson = tryParseJSON(req.body.p_contenttypejson);


    // Merge
    const mergedData = {
  p_objectivejson: p_objectivejson || existingData.p_objectivejson || null,
  p_vendorinfojson: p_vendorinfojson || existingData.p_vendorinfojson || null,
  p_campaignjson: p_campaignjson || existingData.p_campaignjson || null,
  p_campaignfilejson: p_campaignfilejson || existingData.p_campaignfilejson || null,
  p_contenttypejson: p_contenttypejson || existingData.p_contenttypejson || null,
  is_completed: false
};

    await redisClient.set(redisKey, JSON.stringify(mergedData));

    const allPartsPresent =
      mergedData.p_objectivejson &&
      mergedData.p_vendorinfojson &&
      mergedData.p_campaignjson &&
      mergedData.p_campaignfilejson &&
      mergedData.p_contenttypejson;

    if (!allPartsPresent) {
      return res.status(200).json({
        status: false,
        message: "Partial data stored in Redis",
        source: "redis"
      });
    }

    // DB me store
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
    campaignid || null,
    JSON.stringify(mergedData.p_objectivejson),
    JSON.stringify(mergedData.p_vendorinfojson),
    JSON.stringify(mergedData.p_campaignjson),   // ab yaha "name" null nahi hoga
    JSON.stringify(mergedData.p_campaignfilejson),
    JSON.stringify(mergedData.p_contenttypejson)
  ]
);

    await client.query("COMMIT");

    const { p_status, p_message, p_campaignid } = result.rows[0] || {};

    if (p_status) {
      await redisClient.del(redisKey);
      const newRedisKey = `getCampaign:${userId}:${p_campaignid}`;
      await redisClient.setEx(newRedisKey, 120, JSON.stringify(mergedData));

      return res.status(200).json({
        status: true,
        message: p_message || "Campaign saved successfully",
        campaignId: p_campaignid
      });
    } else {
      return res.status(400).json({ status: false, message: p_message || "Failed to save campaign" });
    }

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ createMyCampaign error:", error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

// ---------------- GET Campaign ----------------

export const getCampaign = async (req, res) => {
  try {
    const userId = req.user?.id || req.query.p_userid;
    const campaignId = req.params.campaignId;
console.log(userId,campaignId)
    if (!userId || !campaignId)
      return res.status(400).json({ message: "User ID and Campaign ID are required" });

    const redisKey = `getCampaign:${userId}:${campaignId}`;
    console.log("👉 Redis Key:", redisKey);

    // Redis se fetch karo
    const cachedData = await redisClient.get(redisKey);
    if (cachedData) {
      console.log("💾 Cache hit from Redis", cachedData);
      const parsed = JSON.parse(cachedData);
      return res.status(200).json({
        message: "Campaign data from Redis (partial or full)",
        profileParts: parsed,
        source: "redis"
      });
    }

    // DB fetch
    const result = await client.query(
      `SELECT * FROM ins.fn_get_campaigndetailsjson($1::BIGINT,$2::BIGINT)`,
      [userId, campaignId]
    );

    if (result.rows.length === 0) return res.status(404).json({ message: "Campaign not found" });

    const fullData = result.rows[0];
    await redisClient.setEx(redisKey, 120, JSON.stringify(fullData));

    return res.status(200).json({
      message: "Campaign data from DB",
      profileParts: fullData,
      source: "db"
    });

  } catch (err) {
    console.error("❌ getCampaign error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
