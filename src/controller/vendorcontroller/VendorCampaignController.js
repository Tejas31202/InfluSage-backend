import { client } from "../../config/db.js";
import redis from "redis";

const redisClient = redis.createClient({ url: process.env.REDIS_URL });
redisClient.connect().catch(console.error);

export const createMyCampaign = async (req, res) => {
  const userId = req.user?.id || req.body.p_userid;
  const {
    campaignid,
    p_objectivejson,
    p_vendorinfojson,
    p_campaignjson,
    p_campaignfilejson,
    p_contenttypejson
  } = req.body;

  // Temporary Redis key if campaignid not yet generated
  const redisKey = `getCampaign:${userId}`;
  console.log("👉 Redis Key:", redisKey);
  console.log("👉 Incoming Request Body:", req.body);

  try {
    if (!userId) return res.status(400).json({ message: "User ID is required" });

    // Redis se purana data
    let existingData = await redisClient.get(redisKey);
    existingData = existingData ? JSON.parse(existingData) : {};
    console.log("🔎 Existing Redis Data:", existingData);

    // Merge new incoming data with existing Redis
    const mergedData = {
      p_objectivejson: p_objectivejson || existingData.p_objectivejson || null,
      p_vendorinfojson: p_vendorinfojson || existingData.p_vendorinfojson || null,
      p_campaignjson: p_campaignjson || existingData.p_campaignjson || null,
      p_campaignfilejson: p_campaignfilejson || existingData.p_campaignfilejson || null,
      p_contenttypejson: p_contenttypejson || existingData.p_contenttypejson || null,
      is_completed: false
    };
    console.log("✅ Merged Data:", mergedData);

    // Redis me store karo
    await redisClient.set(redisKey, JSON.stringify(mergedData));
    console.log("💾 Redis Updated Successfully");

    // Check all parts
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

    // ✅ Full data → DB me save karo
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
        JSON.stringify(mergedData.p_contenttypejson)
      ]
    );
    await client.query("COMMIT");

    // SP se status, message, campaignid milega
    const { p_status, p_message, p_campaignid } = result.rows[0] || {};

    if (p_status) {
      // Redis delete old key
      await redisClient.del(redisKey);

      // Set new Redis key with proper campaignId
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
