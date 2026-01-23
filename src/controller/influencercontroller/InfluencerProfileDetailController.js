import { client } from "../../config/Db.js";
import { createClient } from "@supabase/supabase-js";
import Redis from "../../utils/RedisWrapper.js";
import path from "path";
import fs from "fs";
import { HTTP, SP_STATUS } from "../../utils/Constants.js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// const Redis = redis.createClient({ url: process.env.REDIS_URL });
// Redis.connect().catch(console.error);

//New Code With Changes
const MAX_PROFILEPHOTO_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_PORTFOLIO_FILE_SIZE = 25 * 1024 * 1024; // 25 MB
export const completeUserProfile = async (req, res) => {
  const userId = req.user?.id || req.body?.userId;

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
    return res.status(HTTP.BAD_REQUEST).json({ message: "User not authenticated" });
  }
  const redisKey = `profile:${userId}`;

  try {
    // Helper functions
    const safeParse = (data) => {
      if (!data) return null;
      if (typeof data === "object") return data; // already parsed
      try {
        return JSON.parse(data);
      } catch {
        return null;
      }
    };


    const saveToRedis = async (data) => {
      await Redis.setEx(redisKey, 604800, data); // 🔥 object directly
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

      if (file.size > MAX_PROFILEPHOTO_SIZE) {
        return res
          .status(HTTP.BAD_REQUEST)
          .json({ message: "Profile photo is too large. The maximum size allowed is 5 MB" });
      }

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
        await supabase.storage
          .from(process.env.SUPABASE_BUCKET)
          .remove(oldPaths);
      }

      const { error: uploadError } = await supabase.storage
        .from(process.env.SUPABASE_BUCKET)
        .upload(supabasePath, file.buffer, {
          contentType: file.mimetype,
          upsert: true,
        });
      if (uploadError)
        return res
          .status(HTTP.INTERNAL_ERROR)
          .json({ message: "Failed to upload profile photo" });

      const { data: publicUrlData } = supabase.storage
        .from(process.env.SUPABASE_BUCKET)
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
        if (file.size > MAX_PORTFOLIO_FILE_SIZE) {
          return res
            .status(HTTP.BAD_REQUEST)
            .json({ message: `Portfolio file ${file.originalname} is too large. The maximum size allowed is 25 MB` });
        }
        
        const fileName = file.originalname;
        const supabasePath = `Influencer/${userId}/Portfolio/${fileName}`;

        const { data: existingFiles } = await supabase.storage
          .from(process.env.SUPABASE_BUCKET)
          .list(`Influencer/${userId}/Portfolio`);

        const alreadyExists = existingFiles?.some((f) => f.name === fileName);
        if (!alreadyExists) {
          const { error: uploadError } = await supabase.storage
            .from(process.env.SUPABASE_BUCKET)
            .upload(supabasePath, file.buffer, {
              contentType: file.mimetype,
              upsert: false,
            });
          if (uploadError)
            return res
              .status(HTTP.INTERNAL_ERROR)
              .json({ message: "Failed to upload portfolio files" });
        }

        const { data: publicUrlData } = supabase.storage
          .from(process.env.SUPABASE_BUCKET)
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

    // const existingRedis = await Redis.get(redisKey).catch(() => null);
    // const redisData = existingRedis ? safeParse(existingRedis) : {};
    // const finalData = { ...redisData, ...mergedData };

   const existingRedis = (await Redis.get(redisKey)) || {};
    const finalData = {
      ...existingRedis,      // keep old pages
      ...mergedData          // update current page
    };
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
    let result;
    // Handle different p_code states
    switch (userpcode) {
      case "APPROVED":
        try {
        // Save in DB, clear Redis
        await client.query("BEGIN");
        await client.query(
          "SELECT set_config('app.current_user_id', $1, true)",
          [String(userId)]
        );
        result = await client.query(
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

        return res.status(HTTP.OK).json({
          message:result.rows[0].p_message,
          status:result.rows[0].p_status
        });
        } catch (e) {
          await client.query("ROLLBACK");
          throw e;
        }

      case "BLOCKED":
      case "APPROVALPENDING":
        // Save only in Redis
        // return await saveToRedis(finalData, `User ${userpcode} — data saved in Redis.`);
        return res.status(HTTP.FORBIDDEN).json({
          message: `User ${userpcode} is not allowed to proceed.`,
        });
      // added code HTTP.FORBIDDEN

      case "REJECTED":
      case "PENDINGPROFILE":
        // console.log(userpcode);

        if (!isFullyCompleted) {
          // Incomplete → save in Redis and respond
          await saveToRedis(finalData);
          return res.status(HTTP.OK).json({
            message: "Profile incomplete, saved temporarily in Redis",
            source: "redis",
            photopath:finalData.profilejson.photopath,
            profileCompletion:
              (completedParts.length / requiredParts.length) * 100,
            userpcode,
          });
        }

        // Fully completed → save all in DB
        await client.query("BEGIN");
        await client.query(
          "SELECT set_config('app.current_user_id', $1, true)",
          [String(userId)]
        );

        result = await client.query(
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
        if (p_status === SP_STATUS.SUCCESS) {
          await Redis.del(redisKey);
          return res.status(HTTP.OK).json({
            status: true,
            message: p_message,
          });
        } else if (p_status === SP_STATUS.VALIDATION_FAIL) {
          return res.status(HTTP.BAD_REQUEST).json({
            status: false,
            message: p_message,
          });
        } else if (p_status === SP_STATUS.ERROR) {
          console.error("Stored Procedure Failure:", p_message);
          return res.status(HTTP.INTERNAL_ERROR).json({
            status: false,
            message: "Something went wrong. Please try again later.",
          });
        } else {
          return res.status(HTTP.INTERNAL_ERROR).json({
            status: false,
            message: p_message || "Unexpected database response",
          });
        }

        // if (p_status) {
        //   await Redis.del(redisKey);
        //   return res.status(HTTP.OK).json({
        //     message: p_message,
        //     source: "db",
        //     data: result.rows[0],
        //   });
        // }

        // return res.status(HTTP.BAD_REQUEST).json({
        //   message: p_message,
        //   source: "db",
        // });

      default:
        // Unknown p_code → Save only in Redis
        // return await saveToRedis(finalData, "Unknown p_code — saved in Redis.");
        await saveToRedis(finalData);
        return res.status(HTTP.OK).json({
          message: "Unknown p_code — saved in Redis",
          source: "redis",
        });
    }
  } catch (error) {
    console.error("error in complateUserProfile:", error);
    await client.query("ROLLBACK").catch(() => {}); // fail-safe rollback
    return res.status(HTTP.INTERNAL_ERROR).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
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
    // 1. Redis data
    const redisParsed = (await Redis.get(redisKey)) || {};

    // 2. DB full data
    const result = await client.query(
      `SELECT * FROM ins.fn_get_userprofile($1::BIGINT)`,
      [userId]
    );

    const row = result.rows[0] || {};

    const dbData = {
      p_profile: row.p_profile || {},
      p_socials: row.p_socials || [],
      p_categories: row.p_categories || {},
      p_portfolios: row.p_portfolios || [],
      p_paymentaccounts: row.p_paymentaccounts || [],
    };

    // 3. Redis → DB mapping
    const redisDataMapped = {
      p_profile: redisParsed?.profilejson ?? null,
      p_socials: redisParsed?.socialaccountjson ?? null,
      p_categories: redisParsed?.categoriesjson ?? null,
      p_portfolios: redisParsed?.portfoliojson ?? null,
      p_paymentaccounts: redisParsed?.paymentjson ?? null,
    };

    // 4. Merge logic (Redis overrides DB)
    const merged = {
      p_profile: redisDataMapped.p_profile ?? dbData.p_profile,
      p_socials: redisDataMapped.p_socials ?? dbData.p_socials,
      p_categories: redisDataMapped.p_categories ?? dbData.p_categories,
      p_portfolios: redisDataMapped.p_portfolios ?? dbData.p_portfolios,
      p_paymentaccounts:
        redisDataMapped.p_paymentaccounts ?? dbData.p_paymentaccounts,
    };

    fixArrays(merged);

    // 5. Decide source (explicit check)
    const isMerged = Object.values(redisDataMapped).some(
      value => value !== null && value !== undefined
    );

    // 6. Profile completion
    const profileCompletion = calculateProfileCompletion(merged);

    return res.status(HTTP.OK).json({
      message: "Profile fetched successfully",
      profileParts: merged,
      profileCompletion,
      source: isMerged ? "merged" : "db",
    });

  } catch (error) {
    console.error("Error in getUserProfile:", error);
    return res.status(HTTP.INTERNAL_ERROR).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};


// Get User Name by Email
export const getUserNameByEmail = async (req, res) => {
  const { email } = req.params;

  try {
    const result = await client.query(
      `SELECT * FROM ins.fn_get_username($1::varchar)`,
      [email]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(HTTP.NOT_FOUND).json({ message: "User not found" });
    }

    return res.status(HTTP.OK).json({
      firstname: user.firstname,
      lastname: user.lastname,
    });
  } catch (error) {
    console.error("Error in getUserNameByEmail:", error);
    return res.status(HTTP.INTERNAL_ERROR).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};

export const deletePortfolioFile = async (req, res) => {
  try {
    const userId = req.user?.id || req.body.userId;
    const filePathToDelete = req.body.filepath;

    if (!userId || !filePathToDelete) {
      return res
        .status(HTTP.BAD_REQUEST)
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
        await Redis.setEx(redisKey, 10800, profileData);
      }
    }

    //  2 Local file delete
    const uploadDir = path.join(process.cwd(), "src", process.env.SUPABASE_BUCKET, "influencer");
    const fileName = path.basename(filePathToDelete);
    const fullPath = path.join(uploadDir, fileName);

    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }

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
    return res.status(HTTP.OK).json({
      status: true,
      message: "Portfolio file deleted successfully",
      portfolioFiles: profileData?.portfoliojson || [],
    });
  } catch (error) {
    console.error("error in deletePortfolioFile:", error);
    return res.status(HTTP.INTERNAL_ERROR).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};
