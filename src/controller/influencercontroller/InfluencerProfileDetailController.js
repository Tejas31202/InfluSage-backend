import { client } from '../../config/Db.js';
import { createClient } from '@supabase/supabase-js';
import redis from 'redis';
import path from 'path';
import fs from 'fs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const redisClient = redis.createClient({ url: process.env.REDIS_URL });
redisClient.connect().catch(console.error);

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
  // console.log("userId===>", userId);
  let username = "user";

  if (req.user?.name) {
    // Split by space and take first word
    username = req.user.name.split(" ")[0].trim();
  }

  //  Fallback: from request body
  else if (req.body?.firstName) {
    username = req.body.firstName.trim();
  }

  // Final fallback: from DB
  else {
    const dbUser = await client.query(
      "SELECT firstname FROM ins.users WHERE id=$1",
      [userId]
    );
    if (dbUser.rows[0]?.firstname) {
      username = dbUser.rows[0].firstname.trim();
    }
  }
  const redisKey = `profile:${userId}`;

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

    // 2 Handle photo upload

    if (req.files?.photo?.[0]) {
      const file = req.files.photo[0];
      const fileName = file.originalname;
      // const newFileName = `${userId}_${username}_photo_${fileName}`;
      const profileFolderPath = `Influencer/${userId}/Profile`;
      const supabasePath = `${profileFolderPath}/${fileName}`;

      // Delete old photos (optional cleanup)
      const { data: existingFiles } = await supabase.storage
        .from("uploads")
        .list(profileFolderPath);
      if (existingFiles?.length > 0) {
        const oldPaths = existingFiles.map(
          (f) => `${profileFolderPath}/${f.name}`
        );
        await supabase.storage.from("uploads").remove(oldPaths);
      }

      // Upload new photo
      const fileBuffer = file.buffer;
      const { error: uploadError } = await supabase.storage
        .from("uploads")
        .upload(supabasePath, fileBuffer, {
          contentType: file.mimetype,
          upsert: true,
        });

      if (uploadError)
        return res
          .status(500)
          .json({ message: "Failed to upload profile photo" });

      const { data: publicUrlData } = supabase.storage
        .from("uploads")
        .getPublicUrl(supabasePath);

      const photoUrl = publicUrlData?.publicUrl;
      if (photoUrl) {
        const parsedProfile = profilejson ? JSON.parse(profilejson) : {};
        parsedProfile.photopath = photoUrl;
        req.body.profilejson = JSON.stringify(parsedProfile);
      }
    }

    // ---------------------------
    // 3 Handle portfolio uploads
    // ---------------------------
    if (req.files?.portfolioFiles) {
      const uploadedFiles = [];

     for (const file of req.files.portfolioFiles) {
    const fileName = file.originalname;
    const newFileName = `${fileName}`;
    const supabasePath = `Influencer/${userId}/Portfolio/${newFileName}`;
    const fileBuffer = file.buffer;

    try {
      // Step 1: Check if file already exists in Supabase
     const { data: existingFile, error: listError } = await supabase.storage
        .from("uploads")
        .list(`Influencer/${userId}/Portfolio`);

      if (listError) {
        console.error("Supabase list error:", listError);
      }

      const fileAlreadyExists = existingFile?.some(
        (f) => f.name === newFileName
      );

      if (fileAlreadyExists) {
        res.status(400).json({message:`File already exists: ${fileName}, skipping upload.`});
      } else {
        // Step 2: Upload only if not exists
        const { error: uploadError } = await supabase.storage
          .from("uploads")
          .upload(supabasePath, fileBuffer, {
            contentType: file.mimetype,
            upsert: false, // upsert false → prevent overwriting
          });

        if (uploadError) {
          console.error("Supabase portfolio upload error:", uploadError);
          return res.status(500).json({
            message: "Failed to upload portfolio files",
          });
        }
      }

      // Step 3: Get public URL (works both for existing & new)
      const { data: publicUrlData } = supabase.storage
        .from("uploads")
        .getPublicUrl(supabasePath);

      uploadedFiles.push({ filepath: publicUrlData.publicUrl });
    } catch (err) {
      console.error("Portfolio file upload error:", err);
    }
  }

      if (portfoliojson) {
        try {
          const parsedPortfolio = JSON.parse(portfoliojson);
          const existingPaths = Array.isArray(parsedPortfolio.filepaths)
            ? parsedPortfolio.filepaths.filter((p) => p?.filepath)
            : [];
          parsedPortfolio.filepaths = [...existingPaths, ...uploadedFiles];
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
    const dbCheck = await client.query(
      "SELECT * FROM ins.fn_get_userprofile($1)",
      [userId]
    );
    const existingUser = dbCheck.rows[0];
    if (
      existingUser?.p_socials !== null &&
      existingUser?.p_categories !== null
    ) {
      //CASE A: User already has socials + categories → update in DB
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
      // 1 Try to fetch Redis partials
      let redisData = {};
      const existingRedis = await redisClient.get(redisKey);
      if (existingRedis) {
        try {
          redisData = JSON.parse(existingRedis);
        } catch (e) {
          console.warn("Redis data corrupted:", e);
        }
      }

      // 2 Merge Redis + current request body (request takes priority)
      const finalData = {
        ...redisData,
        ...mergedData,
      };

      // 3 Check completeness AFTER merging
      const allPartsPresent =
        finalData.profilejson &&
        finalData.socialaccountjson &&
        finalData.categoriesjson &&
        finalData.portfoliojson &&
        finalData.paymentjson;

      // 4 Now update mergedData to be finalData going forward
      mergedData.profilejson = finalData.profilejson;
      mergedData.socialaccountjson = finalData.socialaccountjson;
      mergedData.categoriesjson = finalData.categoriesjson;
      mergedData.portfoliojson = finalData.portfoliojson;
      mergedData.paymentjson = finalData.paymentjson;

      // CASE B: User new or incomplete → check Redis
      if (!allPartsPresent) {
        const existingRedis = await redisClient.get(redisKey);
        let redisData = existingRedis ? JSON.parse(existingRedis) : {};
        redisData = { ...redisData, ...mergedData };
        //Redis store data for 24h->86400 sec
        await redisClient.setEx(redisKey, 86400, JSON.stringify(redisData));
        return res.status(200).json({
          message: "Partial data saved in Redis (first-time user)",
          source: "redis",
        });
      }

      // CASE C: All parts present → insert into DB
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
        // await redisClient.del(redisKey);

        const { p_status, p_message } = result.rows[0] || {};
        if (p_status === true) {
          await redisClient.del(redisKey);
        }

        return res.status(p_status ? 200 : 400).json({
          message: p_message || "Profile created successfully",
          source: "db",
        });
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    }
  } catch (error) {
    console.error(" Error in completeUserProfile:", error);
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
        p_paymentaccounts: parsed.paymentjson || {},
      };

      const profileCompletion = calculateProfileCompletion(profileParts);

      return res.status(200).json({
        message: "Partial profile from Redis",
        profileParts,
        profileCompletion,
        source: "redis",
      });
    }

    // If not in Redis → fetch from DB
    const result = await client.query(
      `SELECT * FROM ins.fn_get_userprofile($1::BIGINT)`,
      [userId]
    );
  
    const {
      p_profile,
      p_socials,
      p_categories,
      p_portfolios,
      p_paymentaccounts,
    } = result.rows[0];

    if (!p_profile && !p_socials && !p_categories && !p_portfolios) {
        return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      message: "get profile from db",
      profileParts: {
        p_profile,
        p_socials,
        p_categories,
        p_portfolios,
        p_paymentaccounts,
      },
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
    const filePathToDelete = req.body.filepath;

    if (!userId || !filePathToDelete) {
      return res
        .status(400)
        .json({ message: "userId and filepath are required" });
    }

    // Redis key
    const redisKey = `getInfluencerProfile:${userId}`;

    // 1 Redis se data fetch
    let profileData = await redisClient.get(redisKey);
    if (profileData) {
      profileData = JSON.parse(profileData);

      if (profileData.portfoliojson) {
        profileData.portfoliojson = profileData.portfoliojson.filter(
          (file) => file.filepath !== filePathToDelete
        );
        //Redis store data for 3h->10800sec
        await redisClient.setEx(redisKey, 10800,JSON.stringify(profileData));
      }
    }

    //  2 Local file delete
    const uploadDir = path.join(process.cwd(), "src", "uploads", "influencer");
    const fileName = path.basename(filePathToDelete);
    const fullPath = path.join(uploadDir, fileName);

    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      console.log(" File deleted from local folder:", fullPath);
    }

    // 3 Supabase se delete (actual storage path nikalo)
    const bucketName = "uploads";

    // Public URL ko relative storage path me convert karo
    const supabaseFilePath = filePathToDelete
      .split("/storage/v1/object/public/" + bucketName + "/")[1]
      ?.trim();

    if (!supabaseFilePath) {
      console.warn(
        " Could not extract Supabase file path from URL:",
        filePathToDelete
      );
    } else {
      const { error: supaError } = await supabase.storage
        .from(bucketName)
        .remove([supabaseFilePath]);

      if (supaError) {
        console.error(" Supabase delete error:", supaError.message);
      } else {
        console.log("File deleted from Supabase storage:", supabaseFilePath);
      }
    }

    // 🔹 4️⃣ Final response
    return res.status(200).json({
      status: true,
      message: "Portfolio file deleted successfully",
      portfolioFiles: profileData?.portfoliojson || [],
    });
  } catch (error) {
    console.error(" deletePortfolioFile error:", error);
    return res.status(500).json({ status: false, message: error.message });
  }
};
