import { client } from '../../config/Db.js';
import redisClient from '../../config/redis.js';
import path from 'path';
import fs from 'fs';

// const redisClient = redis.createClient({ url: process.env.REDIS_URL });
// redisClient.connect().catch(console.error);

const calculateProfileCompletion = (profileParts) => {
  const partsArray = Object.values(profileParts);
  const totalSections = partsArray.length;

  const filledSections = partsArray.filter(
    (part) => part && Object.keys(part).length > 0
  ).length;

  return Math.round((filledSections / totalSections) * 100);
};

// Complete User Profile
export const completeUserProfile = async (req, res) => {
  const userId = req.user?.id || req.body?.userId;
  let username = "user";

  // ✅ Log current session ID
  console.log("Session ID =>", req.sessionID);

  // ✅ Use session-based Redis key (no conflict across devices)
  const redisKey = `profile:${req.sessionID}`;

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

  try {
    // ---------------------------
    // 1 Parse JSON fields from req.body (safe)
    // ---------------------------
    const {
      profilejson = null,
      socialaccountjson = null,
      categoriesjson = null,
      portfoliojson = null,
      paymentjson = null,
    } = req.body || {};

    // ---------------------------
    // 2 Handle photo upload
    // ---------------------------
    if (req.files?.photo) {
      const file = req.files.photo[0];
      const newFileName = `${username}_up_${Date.now()}${path.extname(file.originalname)}`;
      const newPath = path.join("src/uploads/influencer", newFileName);
      fs.renameSync(file.path, newPath);

      const photoPath = `src/uploads/influencer/${newFileName}`;
      if (profilejson) {
        try {
          const parsedProfile = JSON.parse(profilejson);
          parsedProfile.photopath = photoPath;
          req.body.profilejson = JSON.stringify(parsedProfile);
        } catch (err) {
          console.error("Invalid profilejson:", err.message);
        }
      }
    }

    // ---------------------------
    // 3 Handle portfolio uploads
    // ---------------------------
    if (req.files?.portfolioFiles) {
      const portfolioPaths = req.files.portfolioFiles.map((file, index) => {
        const newFileName = `${username}_portfolio_${Date.now()}_${index}${path.extname(file.originalname)}`;
        const newPath = path.join("src/uploads/influencer", newFileName);
        fs.renameSync(file.path, newPath);
        return `src/uploads/influencer/${newFileName}`;
      });

      if (portfoliojson) {
        try {
          const parsedPortfolio = JSON.parse(portfoliojson);

          // Preserve existing filepaths if any
          const existingPaths = Array.isArray(parsedPortfolio.filepaths)
            ? parsedPortfolio.filepaths.filter((p) => p?.filepath)
            : [];

          // Add new uploaded files
          const newPaths = portfolioPaths.map((p) => ({
            filepath: p,
          }));

          parsedPortfolio.filepaths = [...existingPaths, ...newPaths];

          req.body.portfoliojson = JSON.stringify(parsedPortfolio);
        } catch (err) {
          console.error("Invalid portfoliojson:", err.message);
        }
      }
    }

    // ---------------------------
    // 4 Merge incoming data (safe JSON.parse)
    // ---------------------------
    const safeParse = (data) => {
      try {
        return data ? JSON.parse(data) : null;
      } catch {
        return null;
      }
    };

    const mergedData = {
      ...(req.body.profilejson && {
        profilejson: safeParse(req.body.profilejson),
      }),
      ...(socialaccountjson && {
        socialaccountjson: safeParse(socialaccountjson),
      }),
      ...(categoriesjson && { categoriesjson: safeParse(categoriesjson) }),
      ...(req.body.portfoliojson && {
        portfoliojson: safeParse(req.body.portfoliojson),
      }),
      ...(paymentjson && { paymentjson: safeParse(paymentjson) }),
    };

    // ---------------------------
    // 5 Check existing profile from DB
    // ---------------------------
    const dbCheck = await client.query("SELECT * FROM ins.fn_get_userprofile($1)", [userId]);
    const existingUser = dbCheck.rows[0];

    if (existingUser?.p_socials !== null && existingUser?.p_categories !== null) {
      // ✅ CASE A: User already has socials + categories → update in DB
      try {
        await client.query("BEGIN");
        const result = await client.query(
          `CALL ins.usp_upsert_userprofile(
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

        const { p_status, p_message } = result.rows[0] || {};
        return res.status(p_status ? 200 : 400).json({
          message: p_message || "Profile updated successfully",
          source: "db",
        });
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    } else {
      // ✅ CASE B: User new or incomplete → check Redis (session-based)
      let redisData = {};
      const existingRedis = await redisClient.get(redisKey);
      if (existingRedis) {
        try {
          redisData = JSON.parse(existingRedis);
        } catch (e) {
          console.warn("Redis data corrupted:", e);
        }
      }

      const finalData = { ...redisData, ...mergedData };

      const allPartsPresent =
        finalData.profilejson &&
        finalData.socialaccountjson &&
        finalData.categoriesjson &&
        finalData.portfoliojson &&
        finalData.paymentjson;

      // 🔹 Partial save to Redis
      if (!allPartsPresent) {
        await redisClient.set(redisKey, JSON.stringify(finalData));
        console.log("Partial data saved in Redis for session:", req.sessionID);

        return res.status(200).json({
          message: "Partial data saved in Redis (first-time user, session-based)",
          redisKey,
          source: "redis",
        });
      }

      // ✅ CASE C: All parts present → insert into DB
      try {
        await client.query("BEGIN");
        const result = await client.query(
          `CALL ins.usp_upsert_userprofile(
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
            JSON.stringify(finalData.profilejson),
            JSON.stringify(finalData.socialaccountjson),
            JSON.stringify(finalData.categoriesjson),
            JSON.stringify(finalData.portfoliojson),
            JSON.stringify(finalData.paymentjson),
            null,
            null,
          ]
        );
        await client.query("COMMIT");

        const { p_status, p_message } = result.rows[0] || {};
        if (p_status === true) {
          await redisClient.del(redisKey);
          console.log("Redis cleared for session:", req.sessionID);
        }

        return res.status(p_status ? 200 : 400).json({
          message: p_message || "Profile created successfully",
          redisKey,
          source: "db",
        });
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    }
  } catch (error) {
    console.error("💥 Error in completeUserProfile:", error);
    return res.status(500).json({ message: error.message });
  }
};

// Get User Profile
export const getUserProfile = async (req, res) => {
  const userId = req.params.userId;

  // 🔹 Log and use session ID
  console.log("Session ID =>", req.sessionID);
  const redisKey = `profile:${req.sessionID}`;

  try {
    const cachedData = await redisClient.get(redisKey);

    if (cachedData) {
      const parsed = JSON.parse(cachedData);
      const profileParts = {
        p_profile: parsed.profilejson || {},
        p_socials: parsed.socialaccountjson || {},
        p_categories: parsed.categoriesjson || {},
        p_portfolios: parsed.portfoliojson || {},
        p_paymentaccounts: parsed.paymentjson || {},
      };

      const profileCompletion = calculateProfileCompletion(profileParts);

      console.log("Profile fetched from Redis for session:", req.sessionID);

      return res.status(200).json({
        message: "Partial profile from Redis (session-based)",
        profileParts,
        profileCompletion,
        redisKey,
        source: "redis",
      });
    }

    // else fetch from DB
    const result = await client.query(
      `SELECT * FROM ins.fn_get_userprofile($1::BIGINT)`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found." });
    }

    const {
      p_profile,
      p_socials,
      p_categories,
      p_portfolios,
      p_paymentaccounts,
    } = result.rows[0];

    console.log("Profile fetched from DB for session:", req.sessionID);

    return res.status(200).json({
      message: "Profile from DB",
      profileParts: {
        p_profile,
        p_socials,
        p_categories,
        p_portfolios,
        p_paymentaccounts,
      },
      redisKey,
      source: "db",
    });
  } catch (err) {
    console.error("Error fetching user profile:", err);
    return res.status(500).json({ message: "Internal server error" });
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

export const deletePortfolioFile = async (req, res) => {
  try {
    const userId = req.user?.id || req.body.userId;
    const filePathToDelete = req.body.filepath; // frontend se milega

    if (!userId || !filePathToDelete) {
      return res
        .status(400)
        .json({ message: "userId and filepath are required" });
    }

    // Redis key (influencer profile ke liye)
    const redisKey = `getInfluencerProfile:${userId}`;

    // 1 Redis se data fetch
    let profileData = await redisClient.get(redisKey);
    if (profileData) {
      profileData = JSON.parse(profileData);

      if (profileData.portfoliojson) {
        profileData.portfoliojson = profileData.portfoliojson.filter(
          (file) => file.filepath !== filePathToDelete
        );

        await redisClient.set(redisKey, JSON.stringify(profileData));
      }
    }

    const uploadDir = path.join(process.cwd(), "src", "uploads", "influencer");

    const fileName = path.basename(filePathToDelete);

    const fullPath = path.join(uploadDir, fileName);

    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      console.log(" File deleted from folder:", fullPath);
    } else {
      return res.status(404).json({
        status: false,
        message: "File not found in folder"
      });
    }

    return res.status(200).json({
      status: true,
      message: "Portfolio file deleted successfully",
      portfolioFiles: profileData?.portfoliojson || [],
    });
  } catch (error) {
    console.error("❌ deletePortfolioFile error:", error);
    return res.status(500).json({ status: false, message: error.message });
  }
};
