import { client } from '../../config/Db.js';
import { redisClient } from "../../config/redis.js";
import path from 'path';

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);


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
    const cachedData = await redisClient.get(redisKey);

    if (cachedData) {
      return res.status(200).json({
        companySizes: JSON.parse(cachedData),
        source: "redis",
      });
    }

    const result = await client.query("SELECT * FROM ins.fn_get_companysize()");

    await redisClient.set(redisKey, JSON.stringify(result.rows), { ex: 300 });// TTL 5 mins

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

    await redisClient.set(redisKey, JSON.stringify(result.rows), { ex: 300 }); // TTL: 5 mins

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
        p_paymentaccounts: parsed.paymentjson || {},
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
      `SELECT * FROM ins.fn_get_vendorprofile($1::BIGINT)`,
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
  const redisKey = `vendorprofile:${userId}`;

  try {
    // ---------------------------
    // 1️⃣ Parse JSON fields from req.body (safe)
    // ---------------------------
    const {
      profilejson = null,
      categoriesjson = null,
      providersjson = null,
      objectivesjson = null,
      paymentjson = null,
    } = req.body || {};

    // Step 1: Handle uploaded photo
    let updatedProfileJson = profilejson ? JSON.parse(profilejson) : {};

    // ---------------------------
    // 2️⃣ Handle Profile Photo Upload (Debug + Safe Upload)
    // ---------------------------
    if (req.file) {
      const file = req.file;

      // Quick check for file buffer
      if (!file.buffer || file.buffer.length === 0) {
        return res.status(400).json({ message: "No valid file buffer found" });
      }

      const fileName =file.originalname;
      const newFileName = `${userId}_${username}_photo_${fileName}`;
      const profileFolderPath = `Vendor/${userId}_${username}/Profile`;
      const supabasePath = `${profileFolderPath}/${newFileName}`;

      // List & remove old profile photos (optional cleanup)
      const { data: existingFiles, error: listError } = await supabase.storage
        .from("uploads_UAT")
        .list(profileFolderPath, { limit: 100 });

      if (!listError && existingFiles?.length > 0) {
        const oldFilePaths = existingFiles.map(
          (f) => `${profileFolderPath}/${f.name}`
        );
        await supabase.storage.from("uploads_UAT").remove(oldFilePaths);
      }

      // Upload new photo
      const { error: uploadError } = await supabase.storage
        .from("uploads_UAT")
        .upload(supabasePath, file.buffer, {
          contentType: file.mimetype,
          upsert: true,
        });

      if (uploadError) {
        return res
          .status(500)
          .json({ message: "Image upload failed", error: uploadError.message });
      }

      // Get public URL for uploaded image
      const { data: publicUrlData } = supabase.storage
        .from("uploads_UAT")
        .getPublicUrl(supabasePath);

      if (!publicUrlData?.publicUrl) {
        return res.status(500).json({ message: "Could not get public URL" });
      }

      updatedProfileJson.photopath = publicUrlData.publicUrl;
    }
    const safeParse = (data) => {
      try {
        return data ? JSON.parse(data) : null;
      } catch {
        return null;
      }
    };

    const mergedData = {
      ...(req.body.profilejson && { profilejson: updatedProfileJson }),
      ...(categoriesjson && { categoriesjson: safeParse(categoriesjson) }),
      ...(providersjson && { providersjson: safeParse(providersjson) }),
      ...(req.body.objectivesjson && {
        objectivesjson: safeParse(objectivesjson),
      }),
      ...(paymentjson && { paymentjson: safeParse(paymentjson) }),
    };

    // ---------------------------
    // 5️⃣ Check existing profile from DB
    // ---------------------------
    const dbCheck = await client.query(
      `SELECT * FROM ins.fn_get_vendorprofile($1::BIGINT)`,
      [userId]
    );
    const existingUser = dbCheck.rows[0];

    // ---------------------------
    // 6️⃣ Logic based on existing profile
    // ---------------------------
    if (
      existingUser?.p_categories !== null &&
      existingUser?.p_objectives !== null
    ) {
      // CASE A: User already has provider  + objectives → update in DB
      try {
        await client.query("BEGIN");
        const result = await client.query(
          `CALL ins.usp_upsert_vendorprofile(
          $1::BIGINT, $2::JSON, $3::JSON, $4::JSON, $5::JSON, $6::JSON, $7::BOOLEAN, $8::TEXT
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
        return res.status(p_status ? 200 : 400).json({
          message: p_message || "Profile updated successfully",
          source: "db",
        });
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    } else {
      // 1️⃣ Try to fetch Redis partials
      let redisData = {};
      const existingRedis = await redisClient.get(redisKey);
      if (existingRedis) {
        try {
          redisData = JSON.parse(existingRedis);
        } catch (e) {
          console.warn("Redis data corrupted:", e);
        }
      }

      // 2️⃣ Merge Redis + current request body (request takes priority)
      const finalData = {
        ...redisData,
        ...mergedData,
      };

      // 3️⃣ Check completeness AFTER merging
      const allPartsPresent =
        finalData.profilejson &&
        finalData.categoriesjson &&
        finalData.providersjson &&
        finalData.objectivesjson &&
        finalData.paymentjson;

      // 4️⃣ Now update mergedData to be finalData going forward
      mergedData.profilejson = finalData.profilejson;
      mergedData.categoriesjson = finalData.categoriesjson;
      mergedData.providersjson = finalData.providersjson;
      mergedData.objectivesjson = finalData.objectivesjson;
      mergedData.paymentjson = finalData.paymentjson;

      // ✅ CASE B: User new or incomplete → check Redis
      if (!allPartsPresent) {
        const existingRedis = await redisClient.get(redisKey);
        let redisData = existingRedis ? JSON.parse(existingRedis) : {};
        redisData = { ...redisData, ...mergedData };

        await redisClient.set(redisKey, JSON.stringify(redisData));
        return res.status(200).json({
          message: "Partial data saved in Redis (first-time user)",
          source: "redis",
        });
      }

      // ✅ CASE C: All parts present → insert into DB
      try {
        await client.query("BEGIN");
        const result = await client.query(
          `CALL ins.usp_upsert_vendorprofile(
          $1::BIGINT, $2::JSON, $3::JSON, $4::JSON, $5::JSON, $6::JSON, $7::BOOLEAN, $8::TEXT
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
    await client.query("ROLLBACK");
    console.error("Error in completeVendorProfile:", error);
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

    await redisClient.set(redisKey, JSON.stringify(result.rows), { ex: 300 }); // TTL 5 mins

    return res.status(200).json({
      objectives: result.rows,
      source: "db",
    });
  } catch (error) {
    console.error("Error fetching objectives:", error);
    return res.status(500).json({ message: "Failed to fetch objectives" });
  }
};
