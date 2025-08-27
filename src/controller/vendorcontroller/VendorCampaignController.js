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

  const redisKey = `getCampaign:${userId}`;
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

    // Redis me merge karke store karna
await redisClient.set(redisKey, JSON.stringify(mergedData));

// Check if all required parts present
const allPartsPresent =
    mergedData.p_objectivejson &&
    mergedData.p_vendorinfojson &&
    mergedData.p_campaignjson &&
    mergedData.p_campaignfilejson &&
    mergedData.p_contenttypejson;

// Agar sab complete nahi → SP call mat karo
if (!allPartsPresent) {
    return res.status(200).json({
        status: false,
        message: "Partial data stored in Redis. SP not called yet.",
        source: "redis",
    });
}

//  Yaha pe hi SP call karein, sirf jab saare parts present ho
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
        JSON.stringify(mergedData.p_campaignjson),
        JSON.stringify(mergedData.p_campaignfilejson),
        JSON.stringify(mergedData.p_contenttypejson),
    ]
);
await client.query("COMMIT");


    const { p_status, p_message, p_campaignid } = result.rows[0] || {};

    if (p_status) {
      await redisClient.del(redisKey);
      const newRedisKey = `getCampaign:${userId}`;
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
    const campaignId = req.params.campaignId || "temp";

    const redisKey = `getCampaign:${userId}`;
    console.log("👉 Redis Key:", redisKey);

    const cachedData = await redisClient.get(redisKey);

    if (cachedData) {
      return res.status(200).json({
        message: "Campaign data from Redis (partial or full)",
        profileParts: JSON.parse(cachedData),
        source: "redis"
      });
    }

    // agar Redis me nahi mila aur campaignId != temp hai, tabhi DB se fetch karo
    if (campaignId !== "temp") {
      const result = await client.query(
        `SELECT * FROM ins.fn_get_campaigndetailsjson($1::BIGINT,$2::BIGINT)`,
        [userId, campaignId]
      );

      if (result.rows.length === 0)
        return res.status(404).json({ message: "Campaign not found" });

      const fullData = result.rows[0];
      await redisClient.setEx(redisKey, 120, JSON.stringify(fullData));

      return res.status(200).json({
        message: "Campaign data from DB",
        profileParts: fullData,
        source: "db"
      });
    }

    return res.status(404).json({ message: "No campaign data found" });

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
