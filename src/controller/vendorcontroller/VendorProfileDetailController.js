import { client } from '../../config/Db.js';
import Redis from '../../utils/RedisWrapper.js';
import path from 'path';

import { createClient } from '@supabase/supabase-js';
import { HTTP, SP_STATUS } from '../../utils/Constants.js';
import { error } from 'console';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// const Redis = redis.createClient({ url: process.env.REDIS_URL });
// Redis.connect().catch(console.error);

const calculateProfileCompletion = (profileParts) => {
  const partsArray = Object.values(profileParts);
  const totalSections = partsArray.length;

  const filledSections = partsArray.filter(
    (part) => part && Object.keys(part).length > 0
  ).length;

  return Math.round((filledSections / totalSections) * 100);
};

export const getCompanySizes = async (req, res) => {
  const redisKey = "company_sizes";

  try {
    const cachedData = await Redis.get(redisKey);

    if (cachedData) {
      return res.status(HTTP.OK).json({
        companySizes: cachedData,
        source: "redis",
      });
    }

    const result = await client.query("SELECT * FROM ins.fn_get_companysize()");

    await Redis.setEx(redisKey, 3600, result.rows);

    return res.status(HTTP.OK).json({
      companySizes: result.rows,
      source: "db",
    });
  } catch (error) {
    console.error("Error fetching company sizes:", error);
    return res.status(HTTP.INTERNAL_ERROR).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};


export const getInfluencerTiers = async (req, res) => {
  const redisKey = "influencer_tiers";
  try {
    const cachedData = await Redis.get(redisKey);

    if (cachedData) {
      return res.status(HTTP.OK).json({
        influencerTiers: cachedData,
        source: "redis",
      });
    }

    const result = await client.query(
      "SELECT * FROM ins.fn_get_influencertiers()"
    );

    await Redis.setEx(redisKey, 3600, result.rows); // TTL 60 mins

    return res.status(HTTP.OK).json({
      influencerTiers: result.rows,
      source: "db",
    });
  } catch (error) {
    console.error("Error fetching influencer tiers:", error);
    return res.status(HTTP.INTERNAL_ERROR).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};

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
    console.error("Error fetching user name:", error);
    return res.status(HTTP.INTERNAL_ERROR).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};

export const getVendorProfile = async (req, res) => {
  const vendorId = req.params.userId;
  const redisKey = `vendorprofile:${vendorId}`;
  try {
    const cachedData = await Redis.get(redisKey);

    if (cachedData) {
      // cachedData is already a parsed object from redisWrapper
      const profileParts = {
        p_profile: cachedData.profilejson || {},
        p_categories: cachedData.categoriesjson || {},
        p_providers: cachedData.providersjson || {},
        p_objectives: cachedData.objectivesjson || {},
        p_paymentaccounts: cachedData.paymentjson || {},
        providersSkipped: cachedData.providersSkipped || false, // <-- added
      };
      const profileCompletion = calculateProfileCompletion([
        profileParts.p_profile,
        profileParts.p_categories,
        profileParts.p_providers,
        profileParts.p_objectives,
        profileParts.p_paymentaccounts,
      ]);
      return res.status(HTTP.OK).json({
        message: "Partial profile from Redis",
        profileParts,
        profileCompletion,
        source: "redis",
      });
    }
    // If not in Redis → fetch from DB
    const result = await client.query(
      `SELECT * FROM ins.fn_get_vendorprofile($1::BIGINT)`,
      [vendorId]
    );
    if (result.rows.length === 0) {
      return res.status(HTTP.NOT_FOUND).json({ message: "Vendor not found." });
    }
    const {
      p_profile,
      p_categories,
      p_providers,
      p_objectives,
      p_paymentaccounts,
    } = result.rows[0];
    return res.status(HTTP.OK).json({
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
  } catch (error) {
    console.error("Error fetching vendor profile:", error);
    return res.status(HTTP.INTERNAL_ERROR).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};


const MAX_PROFILEPHOTO_SIZE = 5 * 1024 * 1024; // 5 MB
export const completeVendorProfile = async (req, res) => {
  const userId = req.user?.id || req.body.userid;
  const redisKey = `vendorprofile:${userId}`;
  

  try {
    // Parse JSON fields from req.body (safe)
    const {
      profilejson = null,
      categoriesjson = null,
      providersjson = null,
      objectivesjson = null,
      paymentjson = null,
      providersjsonskipped = null, // <-- add this
    } = req.body || {};

    // Handle uploaded profile photo
    let updatedProfileJson = profilejson ? JSON.parse(profilejson) : {};
    if (req.file) {
      const file = req.file;

      if (!file.buffer || file.buffer.length === 0) {
        return res.status(HTTP.BAD_REQUEST).json({ message: "No valid file buffer found" });
      }
      if (file.size > MAX_PROFILEPHOTO_SIZE) {
        return res.status(HTTP.BAD_REQUEST).json({ message: `Profile photo exceeds maximum size of 5 MB` });
      }

      const fileName = file.originalname;
      const profileFolderPath = `Vendor/${userId}/Profile`;
      const supabasePath = `${profileFolderPath}/${fileName}`;

      // Remove old profile photos
      const { data: existingFiles, error: listError } = await supabase.storage
        .from(process.env.SUPABASE_BUCKET)
        .list(profileFolderPath, { limit: 100 });

      if (!listError && existingFiles?.length > 0) {
        const oldFilePaths = existingFiles.map(f => `${profileFolderPath}/${f.name}`);
        await supabase.storage.from(process.env.SUPABASE_BUCKET).remove(oldFilePaths);
      }

      // Upload new photo
      const { error: uploadError } = await supabase.storage
        .from(process.env.SUPABASE_BUCKET)
        .upload(supabasePath, file.buffer, { contentType: file.mimetype, upsert: true });

      if (uploadError) {
        return res.status(HTTP.INTERNAL_ERROR).json({ message: "Image upload failed", error: uploadError.message });
      }

      const { data: publicUrlData } = await supabase.storage
        .from(process.env.SUPABASE_BUCKET)
        .getPublicUrl(supabasePath);

      if (!publicUrlData?.publicUrl) {
        return res.status(HTTP.INTERNAL_ERROR).json({ message: "Could not get public URL" });
      }

      updatedProfileJson.photopath = publicUrlData.publicUrl;
    }

    // Merge request data
    const mergedData = {
      ...(req.body.profilejson && { profilejson: updatedProfileJson }),
      ...(categoriesjson && { categoriesjson: JSON.parse(categoriesjson) }),
      ...(providersjson && { providersjson: JSON.parse(providersjson) }),
      ...(objectivesjson && { objectivesjson: JSON.parse(objectivesjson) }),
      ...(paymentjson && { paymentjson: JSON.parse(paymentjson) }),
      ...(providersjsonskipped !== null && { providersSkipped: providersjsonskipped === 'true' || providersjsonskipped === true }),
    };
    // Check DB for existing profile
    const dbCheck = await client.query(
      `SELECT * FROM ins.fn_get_vendorprofile($1::BIGINT)`,
      [userId]
    );
    const existingUser = dbCheck.rows[0];

    // CASE A: Already exists in DB → update DB
    if (existingUser?.p_categories !== null && existingUser?.p_objectives !== null) {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.current_user_id', $1, true)", [String(userId)]);
      const result = await client.query(
        `CALL ins.usp_upsert_vendorprofile(
          $1::BIGINT, $2::JSON, $3::JSON, $4::JSON, $5::JSON, $6::JSON, $7::SMALLINT, $8::TEXT
        )`,
        [
          userId,
          JSON.stringify(mergedData.profilejson),
          JSON.stringify(mergedData.categoriesjson),
          JSON.stringify(mergedData.providersjson),
          JSON.stringify(mergedData.objectivesjson),
          JSON.stringify(mergedData.paymentjson),
          null,
          null,
        ]
      );
      await client.query("COMMIT");
      const { p_status, p_message } = result.rows[0] || {};

      if (p_status === SP_STATUS.SUCCESS) return res.status(HTTP.OK).json({ message: p_message, p_status });
      if (p_status === SP_STATUS.VALIDATION_FAIL) return res.status(HTTP.BAD_REQUEST).json({ message: p_message, p_status });
      return res.status(HTTP.INTERNAL_ERROR).json({ message: "Unknown database response", p_status });
    }

    // CASE B: New or incomplete user → handle Redis
    const existingRedis = await Redis.get(redisKey); // already parsed object
    const finalData = { ...(existingRedis || {}), ...mergedData };

    const allPartsPresent =
      finalData.profilejson &&
      finalData.categoriesjson &&
      finalData.providersjson &&
      finalData.objectivesjson &&
      finalData.paymentjson;

    if (!allPartsPresent) {
      await Redis.setEx(redisKey, 86400, finalData); // redisWrapper handles stringify
      return res.status(HTTP.OK).json({
        message: "Partial data saved in Redis (first-time user)",
        photopath:finalData.profilejson.photopath,
        source: "redis",
      });
    }

    // CASE C: All parts present → insert into DB
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.current_user_id', $1, true)", [String(userId)]);
    const result = await client.query(
      `CALL ins.usp_upsert_vendorprofile(
        $1::BIGINT, $2::JSON, $3::JSON, $4::JSON, $5::JSON, $6::JSON, $7::SMALLINT, $8::TEXT
      )`,
      [
        userId,
        JSON.stringify(finalData.profilejson),
        JSON.stringify(finalData.categoriesjson),
        JSON.stringify(finalData.providersjson),
        JSON.stringify(finalData.objectivesjson),
        JSON.stringify(finalData.paymentjson),
        null,
        null,
      ]
    );
    await client.query("COMMIT");

    const { p_status, p_message } = result.rows[0] || {};
    if (p_status === SP_STATUS.SUCCESS) await Redis.del(redisKey);
    if (p_status === SP_STATUS.SUCCESS) return res.status(HTTP.OK).json({ message: p_message, p_status });
    if (p_status === SP_STATUS.VALIDATION_FAIL) return res.status(HTTP.BAD_REQUEST).json({ message: p_message, p_status });
    if (p_status === SP_STATUS.ERROR) {
      console.error("Stored Procedure Failure:", p_message);
      return res.status(HTTP.INTERNAL_ERROR).json({
        message: "Something went wrong. Please try again later.",
        p_status: false,
      });
    }
  return res.status(HTTP.INTERNAL_ERROR).json({ message: p_message || "Unknown error", p_status });
} catch (error) {
  await client.query("ROLLBACK");
  console.error("Error in completeVendorProfile:", error);
  return res.status(500).json({
    message: "Something went wrong. Please try again later.",
    error: error.message,
  });
}
};


export const getObjectives = async (req, res) => {
  const redisKey = "vendor_objectives";
  try {
    const cachedData = await Redis.get(redisKey);
    if (cachedData) {
      return res.status(HTTP.OK).json({
        objectives: cachedData,
        source: "redis",
      });
    }
    const result = await client.query("SELECT * FROM ins.fn_get_objectives();");

    await Redis.setEx(redisKey, 86400, result.rows);

    return res.status(HTTP.OK).json({
      objectives: result.rows,
      source: "db",
    });
  } catch (error) {
    console.error("Error fetching objectives:", error);
    return res.status(HTTP.INTERNAL_ERROR).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};
