import { Client } from "pg";
import { client } from "../../config/db.js";
import authenticateUser from "../../middleware/AuthMiddleware.js";
import redis from "redis";

const redisClient = redis.createClient({ url: process.env.REDIS_URL });
redisClient.connect().catch(console.error);

// function calculateProfileCompletionSingle(part) {
//   if (!part || typeof part !== "object") return 0;
//   const values = Object.values(part);
//   const total = values.length;
//   const filled = values.filter(v => v !== null && v !== "" && v !== undefined).length;
//   if (total === 0) return 0;
//   return Math.round((filled / total) * 100);
// }

// function calculateProfileCompletion(partsArray) {
//   const totalFields = partsArray.reduce((sum, part) => {
//     const values = Object.values(part || {});
//     return sum + values.length;
//   }, 0);

//   const filledFields = partsArray.reduce((sum, part) => {
//     const values = Object.values(part || {});
//     const filled = values.filter(v => v !== null && v !== "" && v !== undefined).length;
//     return sum + filled;
//   }, 0);

//   if (totalFields === 0) return 0;

//   return Math.round((filledFields / totalFields) * 100);
// }

const calculateProfileCompletion = (profileParts) => {
  const partsArray = Object.values(profileParts);
  const totalSections = partsArray.length;

  const filledSections = partsArray.filter(
    (part) => part && Object.keys(part).length > 0
  ).length;

  return Math.round((filledSections / totalSections) * 100);
};

export const getVendorCategories = async (req, res) => {
  const redisKey = "vendor_categories";

  try {
    const cachedData = await redisClient.get(redisKey);

    if (cachedData) {
      return res.status(200).json({
        categories: JSON.parse(cachedData),
        source: "redis",
      });
    }

    const result = await client.query("select * from ins.fn_get_categories();");

    await redisClient.setEx(redisKey, 300, JSON.stringify(result.rows)); // TTL 5 mins

    return res.status(200).json({
      categories: result.rows,
      source: "db",
    });
  } catch (error) {
    console.error("Error fetching vendor categories:", error);
    return res
      .status(500)
      .json({ message: "Failed to fetch vendor categories" });
  }
};

export const getCompanySizes = async (req, res) => {
  const redisKey = "company_sizes";

  try {
    const cachedData = await redisClient.get(redisKey);

    if (cachedData) {
      return res.status(200).json({
        companySizes: JSON.parse(cachedData),
        source: "redis",
      });
    }

    const result = await client.query("SELECT * FROM ins.fn_get_companysize()");

    await redisClient.setEx(redisKey, 300, JSON.stringify(result.rows)); // TTL 5 mins

    return res.status(200).json({
      companySizes: result.rows,
      source: "db",
    });
  } catch (error) {
    console.error("Error fetching company sizes:", error);
    return res.status(500).json({ message: "Failed to fetch company sizes" });
  }
};

export const getInfluencerTiers = async (req, res) => {
  const redisKey = "influencer_tiers";

  try {
    const cachedData = await redisClient.get(redisKey);

    if (cachedData) {
      return res.status(200).json({
        influencerTiers: JSON.parse(cachedData),
        source: "redis",
      });
    }

    const result = await client.query(
      "SELECT * FROM ins.fn_get_influencertiers()"
    );

    await redisClient.setEx(redisKey, 300, JSON.stringify(result.rows)); // TTL 5 mins

    return res.status(200).json({
      influencerTiers: result.rows,
      source: "db",
    });
  } catch (error) {
    console.error("Error fetching influencer tiers:", error);
    return res
      .status(500)
      .json({ message: "Failed to fetch influencer tiers" });
  }
};

export const getUserNameByEmail = async (req, res) => {
  const { email } = req.params; // or use req.body.email if POST

  try {
    const result = await client.query(
      `SELECT * FROM ins.fn_get_username($1::varchar)`,
      [email]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      firstname: user.firstname,
      lastname: user.lastname,
    });
  } catch (error) {
    console.error("Error fetching user name:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getVendorProfile = async (req, res) => {
  const vendorId = req.params.userId;
  const redisKey = `vendorprofile:${vendorId}`;

  try {
    const cachedData = await redisClient.get(redisKey);

    if (cachedData) {
      const parsed = JSON.parse(cachedData);

      const profileParts = {
        p_profile: parsed.profilejson || {},
        p_categories: parsed.categoriesjson || {},
        p_providers: parsed.providersjson || {},
        p_objectives: parsed.objectivesjson || {},
        p_paymentaccount: parsed.paymentjson || {},
      };

      const profileCompletion = calculateProfileCompletion(
        Object.values(profileParts)
      );

      return res.status(200).json({
        message: "Partial profile from Redis",
        profileParts,
        profileCompletion,
        source: "redis",
      });
    }

    // If not in Redis → fetch from DB
    const result = await client.query(
      `SELECT * FROM ins.fn_get_vendorprofilejson($1::BIGINT)`,
      [vendorId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Vendor not found." });
    }

    const {
      p_profile,
      p_categories,
      p_providers,
      p_objectives,
      p_paymentaccounts,
    } = result.rows[0];

    return res.status(200).json({
      message: "get vendor profile from db",
      profileParts: {
        p_profile,
        p_categories,
        p_providers,
        p_objectives,
        p_paymentaccounts,
      },
      source: "db",
    });
  } catch (err) {
    console.error("Error fetching vendor profile:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const completeVendorProfile = async (req, res) => {
  const userId = req.user?.id || req.body.userid;
  const {
    profilejson,
    categoriesjson,
    providersjson,
    objectivesjson,
    paymentjson,
  } = req.body;

  const redisKey = `vendorprofile:${userId}`;
  try {
    // Fetch existing data from Redis
    let existingData = await redisClient.get(redisKey);
    existingData = existingData ? JSON.parse(existingData) : {};

    // Merge new incoming data with existing Redis data
    const mergedData = {
      ...existingData,
      ...(profilejson && { profilejson }),
      ...(categoriesjson && { categoriesjson }),
      ...(providersjson && { providersjson }),
      ...(objectivesjson && { objectivesjson }),
      ...(paymentjson && { paymentjson }),
      is_completed: false,
    };

    // Store updated data in Redis (no TTL)
    await redisClient.set(redisKey, JSON.stringify(mergedData));

    // Check if all parts are present
    const allPartsPresent =
      mergedData.profilejson &&
      mergedData.categoriesjson &&
      mergedData.providersjson &&
      mergedData.objectivesjson &&
      mergedData.paymentjson;

    if (!allPartsPresent) {
      return res.status(200).json({
        message: "Partial data stored in Redis",
        source: "redis",
      });
    }

    // All parts available → Call stored procedure
    await client.query("BEGIN");
    const result = await client.query(
      `CALL ins.sp_complete_vendorprofile(
        $1::BIGINT, $2::JSON, $3::JSON, $4::JSON, $5::JSON, $6::JSON, $7::BOOLEAN, $8::TEXT)`,
      [
        userId,
        JSON.stringify(mergedData.profilejson),
        JSON.stringify(mergedData.categoriesjson),
        JSON.stringify(mergedData.providersjson),
        JSON.stringify(mergedData.objectivesjson),
        JSON.stringify(mergedData.paymentjson),
        null, // Assuming these are optional
        null, // Assuming these are optional
      ]
    );

    await client.query("COMMIT");

    const { p_status, p_message } = result.rows[0];
    if (p_status) {
      // Clear Redis
      await redisClient.del(redisKey);
      return res.status(200).json({ message: p_message });
    } else {
      return res.status(400).json({ message: p_message });
    }
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("complete vendor profile error:", error);

    return res.status(500).json({ message: error.message });
  }
};

export const getObjectives = async (req, res) => {
  const redisKey = "vendor_objectives";

  try {
    const cachedData = await redisClient.get(redisKey);

    if (cachedData) {
      return res.status(200).json({
        objectives: JSON.parse(cachedData),
        source: "redis",
      });
    }

    const result = await client.query("SELECT * FROM ins.fn_get_objectives();");

    await redisClient.setEx(redisKey, 300, JSON.stringify(result.rows)); // TTL: 5 mins

    return res.status(200).json({
      objectives: result.rows,
      source: "db",
    });
  } catch (error) {
    console.error("Error fetching objectives:", error);
    return res.status(500).json({ message: "Failed to fetch objectives" });
  }
};
