import { Client } from "pg";
import fs from 'fs';
import path from 'path';
import { client } from "../../config/db.js";
// import authenticateUser from "../middleware/AuthMiddleware.js";
import redis from 'redis';
import { Console } from "console";

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
  console.log("userid===>",userId)
  const username =req.user.name

      console.log("username===>",username)

  // Parse JSON fields
  const {
    profilejson,
    socialaccountjson,
    categoriesjson,
    portfoliojson,
    paymentjson,
  } = req.body;

  const redisKey = `profile:${userId}`;

  try {
    // Handle uploaded photo
    if (req.files?.photo) {
  const file = req.files.photo[0];
  const newFileName = `${username}_up_${Date.now()}${path.extname(file.originalname)}`;
  const newPath = path.join("src/uploads/influencer", newFileName);

  fs.renameSync(file.path, newPath);

  const photoPath = newPath.replace(/\\/g, "/"); // normalize slashes
  if (profilejson) {
    const parsedProfile = JSON.parse(profilejson);
    parsedProfile.photopath = photoPath;
    req.body.profilejson = JSON.stringify(parsedProfile);
  }
}

    // Handle uploaded portfolio files
   if (req.files?.portfolioFiles) {
  const portfolioPaths = req.files.portfolioFiles.map(
    f => `src/uploads/influencer/${f.filename}`
  );

  if (portfoliojson) {
    const parsedPortfolio = JSON.parse(portfoliojson);

    // ✅ Replace filepaths array with uploaded file paths
    if (parsedPortfolio && Array.isArray(parsedPortfolio.filepaths)) {
      parsedPortfolio.filepaths = portfolioPaths.map(p => ({ filepath: p }));
    }

    req.body.portfoliojson = JSON.stringify(parsedPortfolio);
  }
}

    // Fetch existing data from Redis
    let existingData = await redisClient.get(redisKey);
    existingData = existingData ? JSON.parse(existingData) : {};

    // Merge with new data
    const mergedData = {
      ...existingData,
      ...(req.body.profilejson && {
        profilejson: JSON.parse(req.body.profilejson),
      }),
      ...(socialaccountjson && {
        socialaccountjson: JSON.parse(socialaccountjson),
      }),
      ...(categoriesjson && {
        categoriesjson: JSON.parse(categoriesjson),
      }),
      ...(req.body.portfoliojson && {
        portfoliojson: JSON.parse(req.body.portfoliojson),
      }),
      ...(paymentjson && { paymentjson: JSON.parse(paymentjson) }),
      is_completed: false,
    };

    // Save to Redis
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
        source: "redis",
      });
    }

    // Save to DB if everything is ready
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
        null,
      ]
    );
    await client.query("COMMIT");

    const { p_status, p_message } = result.rows[0];

    if (p_status) {
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
        p_profile: parsed.profilejson || {},
        p_socials: parsed.socialaccountjson || {},
        p_categories: parsed.categoriesjson || {},
        p_portfolios: parsed.portfoliojson || {},
        p_paymentaccounts: parsed.paymentjson || {}
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
      message:"get profile from db",
      profileParts:{p_profile,p_socials,p_categories,p_portfolios,p_paymentaccounts},
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