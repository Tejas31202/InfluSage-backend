import { client } from "../../config/Db.js";
import { createClient } from "@supabase/supabase-js";
import Redis from '../../utils/RedisWrapper.js';
import path from "path";
import fs from "fs";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// const Redis = redis.createClient({ url: process.env.REDIS_URL });
// Redis.connect().catch(console.error);

// const calculateProfileCompletion = (profileParts) => {
//   const partsArray = Object.values(profileParts);
//   const totalSections = partsArray.length;

//   const filledSections = partsArray.filter(
//     (part) => part && Object.keys(part).length > 0
//   ).length;

//   return Math.round((filledSections / totalSections) * 100);
// };

//New Code With Changes
export const completeUserProfile = async (req, res) => {
  const userId = req.user?.id || req.body?.userId;

  //Remove old code after testing
  // let userpcode;
  // try {
  //   const { rows } = await client.query(
  //     "SELECT * FROM ins.fn_get_userstatus($1)",
  //     [userId]
  //   );
  //   // This UserpCode Comes From Db
  //   userpcode = rows[0]?.fn_get_userstatus?.toUpperCase() || null;
  // } catch (err) {
  //   console.error("Error fetching user status:", err);
  //   userpcode = null;
  // }

  //New Code For Testing userpcode comes from db
  let userpcode;

  try {
    const result = await client.query(
      "SELECT ins.fn_get_userstatus($1) AS status",
      [userId]
    );

    const status = result.rows[0]?.status;

    userpcode = status ? status.toUpperCase() : null;
  } catch (err) {
    console.error("Error fetching user status:", err.message);
  }

  if (!userId) {
    return res.status(400).json({ message: "User not authenticated" });
  }
  const redisKey = `profile:${userId}`;
  let username = "user";

  // Username fallback logic
  if (req.user?.name) username = req.user.name.split(" ")[0].trim();
  else if (req.body?.firstName) username = req.body.firstName.trim();
  else {
    const dbUser = await client.query(
      "SELECT firstname FROM ins.users WHERE id=$1",
      [userId]
    );
    if (dbUser.rows[0]?.firstname) username = dbUser.rows[0].firstname.trim();
  }

  try {
    // Helper functions
    const safeParse = (data) => {
      try {
        return data ? JSON.parse(data) : null;
      } catch {
        return null;
      }
    };

    const saveToRedis = async (data) => {
       await Redis.setEx(redisKey, 604800, finalData); // 7 days TTL
    };

    // Parse JSON fields
    const {
      profilejson = null,
      socialaccountjson = null,
      categoriesjson = null,
      portfoliojson = null,
      paymentjson = null,
    } = req.body || {};

    // Handle photo upload
    if (req.files?.photo?.[0]) {
      const file = req.files.photo[0];
      const fileName = file.originalname;
      const profileFolderPath = `Influencer/${userId}/Profile`;
      const supabasePath = `${profileFolderPath}/${fileName}`;

      const { data: existingFiles } = await supabase.storage
        .from(process.env.SUPABASE_BUCKET)
        .list(profileFolderPath);
      if (existingFiles?.length > 0) {
        const oldPaths = existingFiles.map(
          (f) => `${profileFolderPath}/${f.name}`
        );
        await supabase.storage.from(process.env.SUPABASE_BUCKET).remove(oldPaths);
      }

      const { error: uploadError } = await supabase.storage
        .from(process.env.SUPABASE_BUCKE)
        .upload(supabasePath, file.buffer, {
          contentType: file.mimetype,
          upsert: true,
        });
      if (uploadError)
        return res
          .status(500)
          .json({ message: "Failed to upload profile photo" });

      const { data: publicUrlData } = supabase.storage
        .from(process.env.SUPABASE_BUCKE)
        .getPublicUrl(supabasePath);
      const photoUrl = publicUrlData?.publicUrl;

      if (photoUrl) {
        const parsedProfile = safeParse(profilejson) || {};
        parsedProfile.photopath = photoUrl;
        req.body.profilejson = JSON.stringify(parsedProfile);
      }
    }

    // Handle portfolio uploads
    if (req.files?.portfolioFiles) {
      const uploadedFiles = [];

      for (const file of req.files.portfolioFiles) {
        const fileName = file.originalname;
        const supabasePath = `Influencer/${userId}/Portfolio/${fileName}`;

        const { data: existingFiles } = await supabase.storage
          .from(process.env.SUPABASE_BUCKE)
          .list(`Influencer/${userId}/Portfolio`);

        const alreadyExists = existingFiles?.some((f) => f.name === fileName);
        if (!alreadyExists) {
          const { error: uploadError } = await supabase.storage
            .from(process.env.SUPABASE_BUCKE)
            .upload(supabasePath, file.buffer, {
              contentType: file.mimetype,
              upsert: false,
            });
          if (uploadError)
            return res
              .status(500)
              .json({ message: "Failed to upload portfolio files" });
        }

        const { data: publicUrlData } = supabase.storage
          .from(process.env.SUPABASE_BUCKE)
          .getPublicUrl(supabasePath);
        uploadedFiles.push({ filepath: publicUrlData.publicUrl });
      }

      const parsedPortfolio = safeParse(portfoliojson) || {};
      const existingPaths = Array.isArray(parsedPortfolio.filepaths)
        ? parsedPortfolio.filepaths.filter((p) => p?.filepath)
        : [];
      parsedPortfolio.filepaths = [...existingPaths, ...uploadedFiles];
      req.body.portfoliojson = JSON.stringify(parsedPortfolio);
    }

    // Merge body + Redis data
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

    const existingRedis = await Redis.get(redisKey) || {}; // Already parsed object
    const finalData = {
      ...existingRedis,      // keep old pages
      ...mergedData          // update current page
    };


    // Define the required profile parts
    const requiredParts = [
      "profilejson",
      "socialaccountjson",
      "categoriesjson",
      "portfoliojson",
      "paymentjson",
    ];

    // Count how many parts are filled
    const completedParts = requiredParts.filter((k) => finalData[k]);

    // Check if all parts are complete
    const isFullyCompleted = completedParts.length === requiredParts.length;

    // Handle different p_code states
    switch (userpcode) {
      case "APPROVED":
        // Save in DB, clear Redis
        await client.query("BEGIN");
        await client.query(
          `CALL ins.usp_upsert_userprofile(
              $1::bigint, $2::json, $3::json, $4::json, $5::json, $6::json, $7::smallint, $8::text
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
        await Redis.del(redisKey);
        return res
          .status(200)
          .json({ message: "Profile saved successfully (DB)", source: "db" });

      case "BLOCKED":
      case "APPROVALPENDING":
        // Save only in Redis
        // return await saveToRedis(finalData, `User ${userpcode} — data saved in Redis.`);
        return res.status(403).json({
          message: `User ${userpcode} is not allowed to proceed.`,
        });
      // added code 403

      case "REJECTED":
      case "PENDINGPROFILE":
        console.log(userpcode);

        if (!isFullyCompleted) {
          // Incomplete → save in Redis and respond
          await saveToRedis(finalData);
          return res.status(200).json({
            message: "Profile incomplete, saved temporarily in Redis",
            source: "redis",
            profileCompletion:
              (completedParts.length / requiredParts.length) * 100,
            userpcode,
          });
        }

        // Fully completed → save all in DB
        await client.query("BEGIN");
        const result = await client.query(
          `CALL ins.usp_upsert_userprofile(
        $1::bigint, $2::json, $3::json, $4::json, $5::json, $6::json, $7::smallint, $8::text
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
        const { p_status, p_message } = result.rows[0];
        if (p_status) {
          await Redis.del(redisKey);
          return res.status(200).json({
            message: p_message,
            source: "db",
            data: result.rows[0]
          })
          
        }

        return res.status(400).json({
          message: p_message,
          source: "db"
        });

      default:
        // Unknown p_code → Save only in Redis
        // return await saveToRedis(finalData, "Unknown p_code — saved in Redis.");
        await saveToRedis(finalData);
        return res
          .status(200)
          .json({
            message: "Unknown p_code — saved in Redis",
            source: "redis",
          });
    }
  } catch (error) {
    console.error("Error during DB transaction: ", error);
    await client.query("ROLLBACK").catch(() => {}); // fail-safe rollback
    return res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};


// Get User Profile
const calculateProfileCompletion = (profileParts) => {
  const partsArray = Object.values(profileParts);
  const totalSections = partsArray.length;

  const filledSections = partsArray.filter(
    (part) => part && Object.keys(part).length > 0
  ).length;

  return Math.round((filledSections / totalSections) * 100);
};

//fix numeric-key objects to arrays
const fixArrays = (obj) => {
  Object.keys(obj).forEach((key) => {
    if (obj[key] && typeof obj[key] === "object" && !Array.isArray(obj[key])) {
      const isNumericKeys = Object.keys(obj[key]).every((k) => !isNaN(k));
      if (isNumericKeys) {
        obj[key] = Object.values(obj[key]);
      }
    }
  });
  return obj;
};

export const getUserProfile = async (req, res) => {
  const userId = req.params.userId;
  const redisKey = `profile:${userId}`;

  try {
    // 1. Redis data (may contain partial edits)
    const redisParsed = await Redis.get(redisKey) || {};

    // 2. DB full data
    const result = await client.query(
      `SELECT * FROM ins.fn_get_userprofile($1::BIGINT)`,
      [userId]
    );

    const dbData = {
      p_profile: result.rows[0].p_profile || {},
      p_socials: result.rows[0].p_socials || [],
      p_categories: result.rows[0].p_categories || {},
      p_portfolios: result.rows[0].p_portfolios || [],
      p_paymentaccounts: result.rows[0].p_paymentaccounts || [],
    };

    // 3. Mapping Redis keys → DB keys
    const redisDataMapped = {
      p_profile: redisParsed.profilejson,
      p_socials: redisParsed.socialaccountjson,
      p_categories: redisParsed.categoriesjson,
      p_portfolios: redisParsed.portfoliojson,
      p_paymentaccounts: redisParsed.paymentjson,
    };

    // 4. Merge logic WITHOUT deep merge
    const merged = {
      p_profile: redisDataMapped.p_profile ?? dbData.p_profile,
      p_socials: redisDataMapped.p_socials ?? dbData.p_socials,
      p_categories: redisDataMapped.p_categories ?? dbData.p_categories,
      p_portfolios: redisDataMapped.p_portfolios ?? dbData.p_portfolios,
      p_paymentaccounts:
        redisDataMapped.p_paymentaccounts ?? dbData.p_paymentaccounts,
    };

    // Fix numeric-key objects if any
    fixArrays(merged);

    // 5. Decide source properly
    const isMerged = Object.keys(redisDataMapped).some(
      (key) =>
        redisDataMapped[key] !== null && redisDataMapped[key] !== undefined
    );

    // 6. Calculate profile completion
    const profileCompletion = calculateProfileCompletion(merged);

    return res.status(200).json({
      message: "Profile fetched successfully",
      profileParts: merged,
      profileCompletion,
      source: isMerged ? "merged" : "db",
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
    const redisKey = `profile:${userId}`;

    // 1 Redis se data fetch
    let profileData = await Redis.get(redisKey);
    if (profileData) {
      // profileData = JSON.parse(profileData);

      if (profileData.portfoliojson) {
        profileData.portfoliojson = profileData.portfoliojson.filter(
          (file) => file.filepath !== filePathToDelete
        );
        //Redis store data for 3h->10800sec
        await Redis.setEx(redisKey, 604800, profileData);;
      }
    }

    //  2 Local file delete
    const uploadDir = path.join(process.cwd(), "src", process.env.SUPABASE_BUCKET, "influencer");
    const fileName = path.basename(filePathToDelete);
    const fullPath = path.join(uploadDir, fileName);

    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      console.log(" File deleted from local folder:", fullPath);
    }

    // 🔹 3️⃣ Supabase se delete (actual storage path nikalo)
    const bucketName = process.env.SUPABASE_BUCKET;

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