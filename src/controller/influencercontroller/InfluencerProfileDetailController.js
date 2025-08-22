import { Client } from "pg";
import { client } from "../../config/db.js";
// import authenticateUser from "../middleware/AuthMiddleware.js";
import redis from 'redis';

const redisClient = redis.createClient({ url: process.env.REDIS_URL });
redisClient.connect().catch(console.error);

const calculateProfileCompletion = (profileParts) => {
  const partsArray = Object.values(profileParts);
  const totalSections = partsArray.length;
 
  const filledSections = partsArray.filter(part => part && Object.keys(part).length > 0
  ).length;
 
  return Math.round((filledSections / totalSections) * 100);
};

// Complete User Profile
export const completeUserProfile = async (req, res) => {
  const userId = req.user?.id || req.body.userid;
  const {
    profilejson,
    socialaccountjson,
    categoriesjson,
    portfoliojson,
    paymentjson
  } = req.body;
 
  const redisKey = `profile:${userId}`;
 
  try {
    // Fetch existing data from Redis
    let existingData = await redisClient.get(redisKey);
    existingData = existingData ? JSON.parse(existingData) : {};
 
    // Merge new incoming data with existing Redis data
    const mergedData = {
      ...existingData,
      ...(profilejson && { profilejson }),
      ...(socialaccountjson && { socialaccountjson }),
      ...(categoriesjson && { categoriesjson }),
      ...(portfoliojson && { portfoliojson }),
      ...(paymentjson && { paymentjson }),
      is_completed: false
    };
 
    // Store updated data in Redis (no TTL)
    await redisClient.set(redisKey, JSON.stringify(mergedData));
 
    // Check if all parts are present
    const allPartsPresent =
      mergedData.profilejson &&
      mergedData.socialaccountjson &&
      mergedData.categoriesjson &&
      mergedData.portfoliojson &&
      mergedData.paymentjson;
 
    if (!allPartsPresent) {
      return res.status(200).json({
        message: "Partial data stored in Redis",
        source: "redis"
      });
    }
 
    // All parts available → Call stored procedure
    await client.query("BEGIN");
    const result = await client.query(
      `CALL ins.sp_complete_userprofile(
    $1::bigint,
    $2::json,
    $3::json,
    $4::json,
    $5::json,
    $6::json,
    $7::boolean,
    $8::text
  )`,
      [
        userId,
        JSON.stringify(mergedData.profilejson),
        JSON.stringify(mergedData.socialaccountjson),
        JSON.stringify(mergedData.categoriesjson),
        JSON.stringify(mergedData.portfoliojson),
        JSON.stringify(mergedData.paymentjson),
        null,
        null
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
    console.error("💥 Error in completeUserProfile:", error);
    return res.status(500).json({ message: error.message });
  }
};

// Get User Profile
export const getUserProfile = async (req, res) => {
  const userId = req.params.userId;
  const redisKey = `profile:${userId}`;
 
  try {
    // Try to fetch from Redis
    const cachedData = await redisClient.get(redisKey);
 
    if (cachedData) {
      const parsed = JSON.parse(cachedData);
 
      const profileParts = {
        profile: parsed.profilejson || {},
        social: parsed.socialaccountjson || {},
        categories: parsed.categoriesjson || {},
        portfolio: parsed.portfoliojson || {},
        payment: parsed.paymentjson || {}
      };
 
      const profileCompletion = calculateProfileCompletion(profileParts);
 
      return res.status(200).json({
        message: "Partial profile from Redis",
        profileParts,
        profileCompletion,
        source: "redis"
      });
    }
 
    // If not in Redis → fetch from DB
    const result = await client.query(
      `SELECT * FROM ins.fn_get_userprofilejson($1::BIGINT)`,
      [userId]
    );
 
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }
 
    const {
      p_profile,
      p_socials,
      p_categories,
      p_portfolios,
      p_paymentaccounts
    } = result.rows[0];
 
    return res.status(200).json({
      p_profile,
      p_socials,
      p_categories,
      p_portfolios,
      p_paymentaccounts,
      source: 'db'
    });
 
  } catch (err) {
    console.error('Error fetching user profile:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
 

// Get User Name by Email
export const getUserNameByEmail = async (req, res) => {
  const { email } = req.params; // or use req.body.email if POST

  try {
    const result = await client.query(
      `SELECT * FROM ins.fn_get_username($1::varchar)`,
      [email]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.status(200).json({
      firstname: user.firstname,
      lastname: user.lastname
    });
  } catch (error) {
    console.error('Error fetching user name:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const getCategories = async (req, res) => {
  const redisKey = 'categories';

  try {
    const cachedData = await redisClient.get(redisKey);

    if (cachedData) {
      return res.status(200).json({
        categories: JSON.parse(cachedData),
        source: 'redis'
      });
    }

    const result = await client.query('select * from ins.fn_get_categories();');

    await redisClient.setEx(redisKey, 300, JSON.stringify(result.rows)); // TTL 5 mins

    return res.status(200).json({
      categories: result.rows,
      source: 'db'
    });
  } catch (error) {
    console.error("Error fetching categories:", error);
    return res.status(500).json({ message: 'Failed to fetch categories' });
  }
};