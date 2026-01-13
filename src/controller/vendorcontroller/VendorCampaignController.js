import { client } from '../../config/Db.js';
import { createClient } from "@supabase/supabase-js";
import Redis from '../../utils/RedisWrapper.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ---------------- FINALIZE Campaign ----------------
export const finalizeCampaign = async (req, res) => {
  try {
    const userId = req.user?.id || req.body.p_userid;
    const campaignId = req.body.p_campaignid || null;
    const p_statusname = req.body.p_statusname;

    if (!userId) return res.status(400).json({ message: "User ID is required" });

    const redisKey = campaignId ? `getCampaign:${userId}:${campaignId}` : `getCampaign:${userId}`;
    let cachedData = await Redis.get(redisKey);
    cachedData = typeof cachedData === "string" ? JSON.parse(cachedData) : cachedData;

    if (!cachedData) return res.status(404).json({
      message: "No campaign data found in Redis to finalize",
      source: "redis",
    });

    // ---------------- DB Transaction ----------------
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.current_user_id', $1, true)", [String(userId)]);
    const result = await client.query(
      `CALL ins.usp_upsert_campaigndetails(
        $1::BIGINT,$2::BIGINT,$3::VARCHAR,$4::JSON,$5::JSON,$6::JSON,$7::JSON,$8::JSON,$9::JSON,$10::smallint,$11::TEXT
      )`,
      [
        userId,
        campaignId,
        p_statusname,
        JSON.stringify(cachedData.p_objectivejson || {}),
        JSON.stringify(cachedData.p_vendorinfojson || {}),
        JSON.stringify(cachedData.p_campaignjson || {}),
        JSON.stringify(cachedData.p_campaigncategoyjson || {}),
        JSON.stringify(cachedData.p_campaignfilejson || {}),
        JSON.stringify(cachedData.p_contenttypejson || {}),
        null,
        null
      ]
    );
    await client.query("COMMIT");

    const row = result.rows[0] || {};
    const p_status = Number(row.p_status);
    const p_message = row.p_message;
    const finalCampaignId = row.p_campaignid;

    if (p_status === 1) {
      // ---------------- Move Files ----------------
      const baseTempFolder = `Vendor/${userId}/Campaigns/_temp`;
      const finalFolderBase = `Vendor/${userId}/Campaigns/${finalCampaignId}`;
      const finalPhotoFolder = `${finalFolderBase}/campaign_profile`;
      const finalPortfolioFolder = `${finalFolderBase}/campaign_portfolio`;

      // Move photos
      const { data: tempPhotos } = await supabase.storage.from(process.env.SUPABASE_BUCKET).list(`${baseTempFolder}/campaign_profile`);
      if (tempPhotos?.length > 0) {
        for (const file of tempPhotos) {
          const oldPath = `${baseTempFolder}/campaign_profile/${file.name}`;
          const newPath = `${finalPhotoFolder}/${file.name}`;
          const { data: fileData, error: downloadErr } = await supabase.storage.from(process.env.SUPABASE_BUCKET).download(oldPath);
          if (!downloadErr) {
            await supabase.storage.from(process.env.SUPABASE_BUCKET).upload(newPath, fileData, { upsert: true });
            await supabase.storage.from(process.env.SUPABASE_BUCKET).remove([oldPath]);
          }
        }
      }

      // Move portfolio
      const { data: tempPortfolios } = await supabase.storage.from(process.env.SUPABASE_BUCKET).list(`${baseTempFolder}/campaign_portfolio`);
      if (tempPortfolios?.length > 0) {
        for (const file of tempPortfolios) {
          const oldPath = `${baseTempFolder}/campaign_portfolio/${file.name}`;
          const newPath = `${finalPortfolioFolder}/${file.name}`;
          const { data: fileData, error: downloadErr } = await supabase.storage.from(process.env.SUPABASE_BUCKET).download(oldPath);
          if (!downloadErr) {
            await supabase.storage.from(process.env.SUPABASE_BUCKET).upload(newPath, fileData, { upsert: true });
            await supabase.storage.from(process.env.SUPABASE_BUCKET).remove([oldPath]);
          }
        }
      }

      // Cleanup temp folders & Redis
      await supabase.storage.from(process.env.SUPABASE_BUCKET).remove([`${baseTempFolder}/campaign_profile`, `${baseTempFolder}/campaign_portfolio`]);
      await Redis.del(redisKey);

      return res.status(200).json({
        status: true,
        message: p_message || "Campaign finalized successfully",
        campaignId: finalCampaignId,
        source: "db",
      });
    }

    else if (p_status === 0) return res.status(400).json({ status: false, message: p_message || "Validation failed", source: "db" });
    else if (p_status === -1) return res.status(500).json({ status: false, message: p_message || "Something went wrong while finalizing campaign" });
    else return res.status(500).json({ status: false, message: "Unexpected database response" });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("finalizeCampaign error:", error);
    return res.status(500).json({ message: "Something went wrong. Please try again later.", error: error.message });
  }
};

// ---------------- GET CAMPAIGN ----------------
export const getCampaign = async (req, res) => {
  try {
    const userId = req.user?.id || req.query.p_userid;
    const campaignId = req.query.campaignId || "01";
    if (!userId) return res.status(400).json({ message: "User ID required" });

    const redisKey = campaignId === "01" ? `getCampaign:${userId}` : `getCampaign:${userId}:${campaignId}`;
    let cachedData = await Redis.get(redisKey);
    cachedData = typeof cachedData === "string" ? JSON.parse(cachedData) : cachedData;

    if (cachedData) return res.status(200).json({ message: campaignId === "01" ? "Draft campaign from Redis" : "Campaign data from Redis", campaignParts: cachedData, source: "redis" });

    const result = await client.query(`SELECT * FROM ins.fn_get_campaigndetailsjson($1::BIGINT, $2::BIGINT)`, [userId, campaignId]);
    if (result.rows.length === 0) return res.status(404).json({ message: "Campaign not found" });

    const fullData = result.rows[0];
    await Redis.setEx(redisKey, 3600, fullData);

    return res.status(200).json({ message: "Campaign data from DB", campaignParts: fullData, source: "db" });
  } catch (error) {
    console.error("Error in getCampaign:", error);
    return res.status(500).json({ message: "Something went wrong. Please try again later.", error: error.message });
  }
};

// ---------------- DELETE FILE ----------------
export const deleteCampaignFile = async (req, res) => {
  try {
    const userId = req.user?.id || req.body.userId;
    const campaignId = req.body.campaignId || null;
    const filePathToDelete = req.body.filepath;
    const bucketName = process.env.SUPABASE_BUCKET;

    if (!userId || !filePathToDelete) return res.status(400).json({ status: false, message: "userId and filepath are required" });

    const redisKey = campaignId ? `getCampaign:${userId}:${campaignId}` : `getCampaign:${userId}`;
    let campaignData = await Redis.get(redisKey);
    campaignData = typeof campaignData === "string" ? JSON.parse(campaignData) : campaignData;

    if (campaignData?.p_campaignfilejson?.length) {
      const requestFileName = filePathToDelete.split("/").pop();
      campaignData.p_campaignfilejson = campaignData.p_campaignfilejson.filter(file => file.filepath.split("/").pop() !== requestFileName);
      await Redis.setEx(redisKey, 3600, campaignData);
    }

    const supabaseFilePath = filePathToDelete.split(`/storage/v1/object/public/${bucketName}/`)[1]?.trim();
    if (!supabaseFilePath) return res.status(400).json({ status: false, message: "Invalid Supabase file path format" });

    const { error: deleteError } = await supabase.storage.from(bucketName).remove([supabaseFilePath]);
    if (deleteError) return res.status(500).json({ status: false, message: "Error deleting file from Supabase", error: deleteError.message });

    return res.status(200).json({ status: true, message: "File deleted successfully from Supabase and Redis", deletedFile: supabaseFilePath, campaignFiles: campaignData?.p_campaignfilejson || [] });
  } catch (error) {
    console.error("error in deleteCampaignFile:", error);
    return res.status(500).json({ message: "Something went wrong. Please try again later.", error: error.message });
  }
};

// ---------------- GET OBJECTIVES ----------------
export const getCampaignObjectives = async (req, res) => {
  try {
    const result = await client.query("SELECT * from ins.fn_get_campaignobjectives()");
    return res.status(200).json({ objectives: result.rows, source: "db" });
  } catch (error) {
    console.error("Error fetching GetCampaignObjectives:", error);
    return res.status(500).json({ message: "Something went wrong. Please try again later.", error: error.message });
  }
};

// ---------------- GET PROVIDER CONTENT TYPES ----------------
export const getProvidorContentTypes = async (req, res) => {
  try {
    const result = await client.query("SELECT * from ins.fn_get_providercontenttypes();");
    return res.status(200).json({ providorType: result.rows, source: "db" });
  } catch (error) {
    console.error("Error fetching getProvidorContentTypes:", error);
    return res.status(500).json({ message: "Something went wrong. Please try again later.", error: error.message });
  }
};

// ---------------- UPSERT CAMPAIGN ----------------
export const upsertCampaign = async (req, res) => {
  try {
    const p_userid = req.user?.id || req.body.p_userid;
    const campaignId = req.body.campaignId || null;
    const isFinalSubmit = req.body.isFinalSubmit || false;
    const p_statusname = req.body.p_statusname || null;

    if (!p_userid) return res.status(400).json({ message: "User ID is required" });

    const parseIfJson = (data) => { try { return data ? JSON.parse(data) : {}; } catch { return {}; } };
    const cleanArray = (arr) => (Array.isArray(arr) ? arr.filter(Boolean) : []);

    const p_objectivejson = parseIfJson(req.body.p_objectivejson);
    const p_vendorinfojson = parseIfJson(req.body.p_vendorinfojson);
    const p_campaignjson = parseIfJson(req.body.p_campaignjson);
    const p_campaigncategoyjson = cleanArray(req.body.p_campaigncategoyjson);
    const p_campaignfilejson = cleanArray(req.body.p_campaignfilejson);
    const p_contenttypejson = cleanArray(req.body.p_contenttypejson);

    // Temp upload paths
    const baseTempFolder = `Vendor/${p_userid}/Campaigns/_temp`;
    const tempPhotoFolder = `${baseTempFolder}/campaign_profile`;
    const tempPortfolioFolder = `${baseTempFolder}/campaign_portfolio`;

    let campaignFiles = [];

    // Upload main photo
    if (req.files?.photo?.[0]) {
      const file = req.files.photo[0];
      const tempPhotoPath = `${tempPhotoFolder}/${file.originalname}`;
      const { error } = await supabase.storage.from(process.env.SUPABASE_BUCKET).upload(tempPhotoPath, file.buffer, { contentType: file.mimetype, upsert: true });
      if (error) throw new Error(`Photo upload failed: ${error.message}`);
      const { data: publicData } = supabase.storage.from(process.env.SUPABASE_BUCKET).getPublicUrl(tempPhotoPath);
      p_campaignjson.photopath = publicData.publicUrl;
    }

    // Upload portfolio files
    if (req.files?.Files?.length > 0) {
      for (const file of req.files.Files) {
        const tempPortfolioPath = `${tempPortfolioFolder}/${file.originalname}`;
        const { error } = await supabase.storage.from(process.env.SUPABASE_BUCKET).upload(tempPortfolioPath, file.buffer, { contentType: file.mimetype, upsert: true });
        if (error) console.warn("⚠️ File upload failed:", error.message);
        const { data: publicData } = supabase.storage.from(process.env.SUPABASE_BUCKET).getPublicUrl(tempPortfolioPath);
        campaignFiles.push({ filepath: publicData.publicUrl });
      }
    }

    // ---------------- REDIS DRAFT ----------------
    const redisKey = `getCampaign:${p_userid}${campaignId ? `:${campaignId}` : ""}`;
    let existingDraft = await Redis.get(redisKey);
    existingDraft = typeof existingDraft === "string" ? JSON.parse(existingDraft) : existingDraft || {};

    const draftData = {
      p_objectivejson: { ...(existingDraft.p_objectivejson || {}), ...p_objectivejson },
      p_vendorinfojson: { ...(existingDraft.p_vendorinfojson || {}), ...p_vendorinfojson },
      p_campaignjson: { ...(existingDraft.p_campaignjson || {}), ...p_campaignjson },
      p_campaigncategoyjson: p_campaigncategoyjson.length ? p_campaigncategoyjson : existingDraft.p_campaigncategoyjson || [],
      p_contenttypejson: p_contenttypejson.length ? p_contenttypejson : existingDraft.p_contenttypejson || [],
      p_campaignfilejson: [...(existingDraft.p_campaignfilejson || []), ...(p_campaignfilejson || []), ...(campaignFiles || [])],
      updated_at: new Date(),
    };

    await Redis.setEx(redisKey, 86400, draftData);

    if (!isFinalSubmit) return res.status(200).json({ status: true, message: "Draft stored in Redis successfully", campaignParts: draftData, source: "redis" });

    // ---------------- DB SAVE ----------------
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.current_user_id', $1, true)", [String(p_userid)]);
    const result = await client.query(
      `CALL ins.usp_upsert_campaigndetails($1::BIGINT,$2::BIGINT,$3::varchar,$4::JSON,$5::JSON,$6::JSON,$7::JSON,$8::JSON,$9::JSON,$10::smallint,$11::TEXT)`,
      [p_userid, campaignId, p_statusname, p_objectivejson || null, p_vendorinfojson || null, req.body.p_campaignjson, p_campaigncategoyjson || null, p_campaignfilejson || null, p_contenttypejson || null, null, null]
    );
    await client.query("COMMIT");

    const row = result.rows[0] || {};
    const p_status = Number(row.p_status);
    const p_message = row.p_message;
    const finalCampaignId = row.p_campaignid;

    if (p_status === 1) await Redis.del(redisKey);

    return p_status === 1
      ? res.status(200).json({ status: true, message: p_message || "Campaign saved successfully", campaignId: finalCampaignId, source: "db" })
      : p_status === 0
      ? res.status(400).json({ status: false, message: p_message || "Validation failed", source: "db" })
      : res.status(500).json({ status: false, message: "Something went wrong while saving campaign" });

  } catch (error) {
    console.error("error in upsertCampaign:", error);
    return res.status(500).json({ message: "Something went wrong. Please try again later.", error: error.message });
  }
};


// old code below
// import { client } from '../../config/Db.js';
// import Redis from '../../utils/RedisWrapper.js';
// import path from 'path';


// import { createClient } from '@supabase/supabase-js';

// const SUPABASE_URL = process.env.SUPABASE_URL;
// const SUPABASE_KEY = process.env.SUPABASE_KEY;

// const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// // const Redis = redis.createClient({ url: process.env.REDIS_URL });
// // Redis.connect().catch(console.error);

// const calculateProfileCompletion = (profileParts) => {
//   const partsArray = Object.values(profileParts);
//   const totalSections = partsArray.length;

//   const filledSections = partsArray.filter(
//     (part) => part && Object.keys(part).length > 0
//   ).length;

//   return Math.round((filledSections / totalSections) * 100);
// };

// export const getCompanySizes = async (req, res) => {
//   const redisKey = "company_sizes";

//   try {
//     const cachedData = await Redis.get(redisKey);

//     if (cachedData) {
//       return res.status(200).json({
//         companySizes: cachedData,
//         source: "redis",
//       });
//     }

//     const result = await client.query("SELECT * FROM ins.fn_get_companysize()");

//     await Redis.setEx(redisKey, 3600, result.rows);

//     return res.status(200).json({
//       companySizes: result.rows,
//       source: "db",
//     });
//   } catch (error) {
//     console.error("Error fetching company sizes:", error);
//     return res.status(500).json({
//       message: "Something went wrong. Please try again later.",
//       error: error.message,
//     });
//   }
// };


// export const getInfluencerTiers = async (req, res) => {
//   const redisKey = "influencer_tiers";
//   try {
//     const cachedData = await Redis.get(redisKey);

//     if (cachedData) {
//       return res.status(200).json({
//         influencerTiers:cachedData,
//         source: "redis",
//       });
//     }

//     const result = await client.query(
//       "SELECT * FROM ins.fn_get_influencertiers()"
//     );

//     await Redis.setEx(redisKey, 3600, result.rows); // TTL 60 mins

//     return res.status(200).json({
//       influencerTiers: result.rows,
//       source: "db",
//     });
//   } catch (error) {
//     console.error("Error fetching influencer tiers:", error);
//     return res.status(500).json({
//       message: "Something went wrong. Please try again later.",
//       error: error.message,
//     });
//   }
// };

// export const getUserNameByEmail = async (req, res) => {
//   const { email } = req.params;

//   try {
//     const result = await client.query(
//       `SELECT * FROM ins.fn_get_username($1::varchar)`,
//       [email]
//     );

//     const user = result.rows[0];

//     if (!user) {
//       return res.status(404).json({ message: "User not found" });
//     }

//     return res.status(200).json({
//       firstname: user.firstname,
//       lastname: user.lastname,
//     });
//   } catch (error) {
//     console.error("Error fetching user name:", error);
//     return res.status(500).json({
//       message: "Something went wrong. Please try again later.",
//       error: error.message,
//     });
//   }
// };

// export const getVendorProfile = async (req, res) => {
//   const vendorId = req.params.userId;
//   const redisKey = `vendorprofile:${vendorId}`;
//     const safeParse = (data) => {
//     try {
//       return JSON.parse(data);
//     } catch {
//       return null;
//     }
//   };
//   try {
//     const cachedData = await Redis.get(redisKey);

//     if (cachedData) {
//       const parsed = safeParse(cachedData); // already parsed


//       const profileParts = {
//         p_profile: parsed.profilejson || {},
//         p_categories: parsed.categoriesjson || {},
//         p_providers: parsed.providersjson || {},
//         p_objectives: parsed.objectivesjson || {},
//         p_paymentaccounts: parsed.paymentjson || {},
//       };
//       const profileCompletion = calculateProfileCompletion(
//         Object.values(profileParts)
//       );
//       return res.status(200).json({
//         message: "Partial profile from Redis",
//         profileParts,
//         profileCompletion,
//         source: "redis",
//       });
//     }
//     // If not in Redis → fetch from DB
//     const result = await client.query(
//       `SELECT * FROM ins.fn_get_vendorprofile($1::BIGINT)`,
//       [vendorId]
//     );
//     if (result.rows.length === 0) {
//       return res.status(404).json({ message: "Vendor not found." });
//     }
//     const {
//       p_profile,
//       p_categories,
//       p_providers,
//       p_objectives,
//       p_paymentaccounts,
//     } = result.rows[0];
//     return res.status(200).json({
//       message: "get vendor profile from db",
//       profileParts: {
//         p_profile,
//         p_categories,
//         p_providers,
//         p_objectives,
//         p_paymentaccounts,
//       },
//       source: "db",
//     });
//   } catch (error) {
//     console.error("Error fetching vendor profile:", error);
//     return res.status(500).json({
//       message: "Something went wrong. Please try again later.",
//       error: error.message,
//     });
//   }
// };

// export const completeVendorProfile = async (req, res) => {
//   const userId = req.user?.id || req.body.userid;

//   const redisKey = `vendorprofile:${userId}`;

//   try {
//     // 1 Parse JSON fields from req.body (safe) 
//     const {
//       profilejson = null,
//       categoriesjson = null,
//       providersjson = null,
//       objectivesjson = null,
//       paymentjson = null,
//     } = req.body || {};

//     // Step 1: Handle uploaded photo
//     let updatedProfileJson = profilejson ? JSON.parse(profilejson) : {};

//     // 2 Handle Profile Photo Upload (Debug + Safe Upload)
//     if (req.file) {
//       const file = req.file;

//       // Quick check for file buffer
//       if (!file.buffer || file.buffer.length === 0) {
//         return res.status(400).json({ message: "No valid file buffer found" });
//       }
//       const fileName = file.originalname;
//       const profileFolderPath = `Vendor/${userId}/Profile`;
//       const supabasePath = `${profileFolderPath}/${fileName}`;

//       // List & remove old profile photos (optional cleanup)
//       const { data: existingFiles, error: listError } = await supabase.storage
//         .from(process.env.SUPABASE_BUCKET)
//         .list(profileFolderPath, { limit: 100 });

//       if (!listError && existingFiles?.length > 0) {
//         const oldFilePaths = existingFiles.map(
//           (f) => `${profileFolderPath}/${f.name}`
//         );
//         await supabase.storage.from(process.env.SUPABASE_BUCKET).remove(oldFilePaths);
//       }

//       // Upload new photo
//       const { error: uploadError } = await supabase.storage
//         .from(process.env.SUPABASE_BUCKET)
//         .upload(supabasePath, file.buffer, {
//           contentType: file.mimetype,
//           upsert: true,
//         });

//       if (uploadError) {
//         return res
//           .status(500)
//           .json({ message: "Image upload failed", error: uploadError.message });
//       }

//       // Get public URL for uploaded image
//       const { data: publicUrlData } = supabase.storage
//         .from(process.env.SUPABASE_BUCKET)
//         .getPublicUrl(supabasePath);

//       if (!publicUrlData?.publicUrl) {
//         return res.status(500).json({ message: "Could not get public URL" });
//       }

//       updatedProfileJson.photopath = publicUrlData.publicUrl;
//     }
//     const safeParse = (data) => {
//       try {
//         return data ? JSON.parse(data) : null;
//       } catch {
//         return null;
//       }
//     };

//     const mergedData = {
//       ...(req.body.profilejson && { profilejson: updatedProfileJson }),
//       ...(categoriesjson && { categoriesjson: safeParse(categoriesjson) }),
//       ...(providersjson && { providersjson: safeParse(providersjson) }),
//       ...(req.body.objectivesjson && {
//         objectivesjson: safeParse(objectivesjson),
//       }),
//       ...(paymentjson && { paymentjson: safeParse(paymentjson) }),
//     };

//     // 5 Check existing profile from DB
//     const dbCheck = await client.query(
//       `SELECT * FROM ins.fn_get_vendorprofile($1::BIGINT)`,
//       [userId]
//     );
//     const existingUser = dbCheck.rows[0];

//     // 6 Logic based on existing profile
//     if (
//       existingUser?.p_categories !== null &&
//       existingUser?.p_objectives !== null
//     ) {
//       // CASE A: User already has provider  + objectives → update in DB
//       try {
//         //for db how much time taken for execute query
//         const dbStart = Date.now();
//         await client.query("BEGIN");
//         await client.query(
//           "SELECT set_config('app.current_user_id', $1, true)",
//           [String(userId)]
//         );
//         const result = await client.query(
//           `CALL ins.usp_upsert_vendorprofile(
//           $1::BIGINT, $2::JSON, $3::JSON, $4::JSON, $5::JSON, $6::JSON, $7::SMALLINT, $8::TEXT
//         )`,
//           [
//             userId,
//             JSON.stringify(mergedData.profilejson),
//             JSON.stringify(mergedData.categoriesjson),
//             JSON.stringify(mergedData.providersjson),
//             JSON.stringify(mergedData.objectivesjson),
//             JSON.stringify(mergedData.paymentjson),
//             null,
//             null,
//           ]
//         );
//         //for db how much time taken for execute
//         console.log("DB query:", Date.now() - dbStart, "ms");

//         await client.query("COMMIT");
//         const { p_status, p_message } = result.rows[0] || {};

//         //  NEW p_status logic
//         if (p_status === 1) return res.status(200).json({ message: p_message, p_status });

//         if (p_status === 0) return res.status(400).json({ message: p_message, p_status });

//         if (p_status === -1) return res.status(500).json({ message: "something went wrong" });

//         return res.status(500).json({
//           message: "Unknown database response",
//           p_status,
//         });
//       } catch (err) {
//         await client.query("ROLLBACK");
//         throw err;
//       }
//     } else {
//       // 1 Try to fetch Redis partials
//       let redisData = {};
//       const existingRedis = await Redis.get(redisKey);
//       if (existingRedis) {
//         try {
//           redisData = JSON.parse(existingRedis);
//         } catch (e) {
//           console.warn("Redis data corrupted:", e);
//         }
//       }
//       // 2 Merge Redis + current request body (request takes priority)
//       const finalData = {
//         ...redisData,
//         ...mergedData,
//       };
//       // 3 Check completeness AFTER merging
//       const allPartsPresent =
//         finalData.profilejson &&
//         finalData.categoriesjson &&
//         finalData.providersjson &&
//         finalData.objectivesjson &&
//         finalData.paymentjson;
//       // 4 Now update mergedData to be finalData going forward
//       mergedData.profilejson = finalData.profilejson;
//       mergedData.categoriesjson = finalData.categoriesjson;
//       mergedData.providersjson = finalData.providersjson;
//       mergedData.objectivesjson = finalData.objectivesjson;
//       mergedData.paymentjson = finalData.paymentjson;
//       //  CASE B: User new or incomplete → check Redis
//       if (!allPartsPresent) {
//         const existingRedis = await Redis.get(redisKey);
//         let redisData = existingRedis ? JSON.parse(existingRedis) : {};
//         redisData = { ...redisData, ...mergedData };

//         await Redis.setEx(redisKey, 86400, JSON.stringify(redisData));
//         return res.status(200).json({
//           message: "Partial data saved in Redis (first-time user)",
//           source: "redis",
//         });
//       }

//       //  CASE C: All parts present → insert into DB
//       try {
//         await client.query("BEGIN");
//         await client.query(
//           "SELECT set_config('app.current_user_id', $1, true)",
//           [String(userId)]
//         );
//         const result = await client.query(
//           `CALL ins.usp_upsert_vendorprofile(
//           $1::BIGINT, $2::JSON, $3::JSON, $4::JSON, $5::JSON, $6::JSON, $7::SMALLINT, $8::TEXT
//         )`,
//           [
//             userId,
//             JSON.stringify(mergedData.profilejson),
//             JSON.stringify(mergedData.categoriesjson),
//             JSON.stringify(mergedData.providersjson),
//             JSON.stringify(mergedData.objectivesjson),
//             JSON.stringify(mergedData.paymentjson),
//             null,
//             null,
//           ]
//         );
//         await client.query("COMMIT");
//         const { p_status, p_message } = result.rows[0] || {};

//         if (p_status === 1) {
//           await Redis.del(redisKey);
//           return res.status(200).json({ message: p_message, p_status });
//         }

//         if (p_status === 0)
//           return res.status(400).json({ message: p_message, p_status });

//         if (p_status === -1)
//           return res.status(500).json({ message: p_message, p_status });

//         return res.status(500).json({
//           message: "Unknown database response",
//           p_status,
//         });
//       } catch (err) {
//         await client.query("ROLLBACK");
//         throw err;
//       }
//     }
//   } catch (error) {
//     await client.query("ROLLBACK");
//     console.error("Error in completeVendorProfile:", error);
//     return res.status(500).json({
//       message: "Something went wrong. Please try again later.",
//       error: error.message,
//     });
//   }
// };

// export const getObjectives = async (req, res) => {
//   const redisKey = "vendor_objectives";
//   try {
//     const cachedData = await Redis.get(redisKey);
//     if (cachedData) {
//       return res.status(200).json({
//         objectives:cachedData,
//         source: "redis",
//       });
//     }
//     const result = await client.query("SELECT * FROM ins.fn_get_objectives();");

//     await Redis.setEx(redisKey, 86400, result.rows);

//     return res.status(200).json({
//       objectives: result.rows,
//       source: "db",
//     });
//   } catch (error) {
//     console.error("Error fetching objectives:", error);
//     return res.status(500).json({
//       message: "Something went wrong. Please try again later.",
//       error: error.message,
//     });
//   }
// };