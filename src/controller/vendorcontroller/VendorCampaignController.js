import { client } from '../../config/Db.js';
import { createClient } from "@supabase/supabase-js";
import { redisClient } from "../../config/redis.js";
import path from 'path';
import fs from 'fs';
import fsPromises from "fs/promises";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ---------------- FINALIZE Campaign ----------------
export const finalizeCampaign = async (req, res) => {
  try {
    const userId = req.user?.id || req.body.p_userid;
    const campaignId = req.body.p_campaignid || null;
    const p_statusname = req.body.p_statusname ;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // Redis key
    const redisKey = campaignId
      ? `getCampaign:${userId}:${campaignId}`
      : `getCampaign:${userId}`;

    const cachedData = await redisClient.get(redisKey);

    if (!cachedData) {
      return res.status(404).json({
        message: "No campaign data found in Redis to finalize",
        source: "redis",
      });
    }

    // ❌ const campaignData = JSON.parse(cachedData);
    // ✔ Already an object
    const campaignData = cachedData;


    // --------------- BEGIN DB TRANSACTION ---------------
    await client.query("BEGIN");

    const result = await client.query(
      `CALL ins.usp_upsert_campaigndetails(
        $1::BIGINT,
        $2::BIGINT,
        $3::VARCHAR,
        $4::JSON,
        $5::JSON,
        $6::JSON,
        $7::JSON,
        $8::JSON,
        $9::JSON,
        $10::boolean,
        $11::TEXT,
        $12::TEXT
      )`,
      [
        userId,
        campaignId,
        p_statusname,
        JSON.stringify(campaignData.p_objectivejson || {}),
        JSON.stringify(campaignData.p_vendorinfojson || {}),
        JSON.stringify(campaignData.p_campaignjson || {}),
        JSON.stringify(campaignData.p_campaigncategoyjson || {}),
        JSON.stringify(campaignData.p_campaignfilejson || {}),
        JSON.stringify(campaignData.p_contenttypejson || {}),
        null,
        null,
        null,
      ]
    );

    await client.query("COMMIT");

    const { p_status, p_message, p_campaignid, p_campaignname } = result.rows[0] || {};

    if (!p_status) {
      return res.status(400).json({
        status: false,
        message: p_message,
      });
    }

    // ------------------- FILE MOVE LOGIC -------------------

    let username= req.user.name.split(" ")[0].trim();

    const baseTempFolder = `Vendor/${userId}_${username}/Campaigns/_temp`;
    const finalFolderBase = `Vendor/${userId}_${username}/Campaigns/${p_campaignid}_${p_campaignname}`;
    const finalPhotoFolder = `${finalFolderBase}/campaign_profile`;
    const finalPortfolioFolder = `${finalFolderBase}/campaign_portfolio`;

    // ------------------- DELETE OLD PHOTO IF EXISTS -------------------
    // const { data: existingPhotos } = await supabase.storage.from("uploads_UAT").list(finalPhotoFolder);

    // if (existingPhotos?.length > 0) {
    //     const oldPhotoPaths = existingPhotos.map((f) => `${finalPhotoFolder}/${f.name}`);
    //     await supabase.storage.from("uploads_UAT").remove(oldPhotoPaths);
    // }

    // Move photo files
    const { data: tempPhotos } = await supabase.storage.from("uploads_UAT").list(`${baseTempFolder}/campaign_profile`);
    if (tempPhotos?.length > 0) {
      for (const file of tempPhotos) {
        const oldPath = `${baseTempFolder}/campaign_profile/${file.name}`;
        const newPath = `${finalPhotoFolder}/${file.name}`;

        const { data: fileData, error: downloadErr } = await supabase.storage
          .from("uploads_UAT")
          .download(oldPath);

        if (downloadErr) {
          console.warn("⚠️ Photo file download failed:", downloadErr.message);
          continue;
        }

        await supabase.storage.from("uploads_UAT").upload(newPath, fileData, { upsert: true });
        await supabase.storage.from("uploads_UAT").remove([oldPath]);
      }
    }

    // Move portfolio files
    const { data: tempPortfolios } = await supabase.storage.from("uploads_UAT").list(`${baseTempFolder}/campaign_portfolio`);
    if (tempPortfolios?.length > 0) {
      for (const file of tempPortfolios) {
        const oldPath = `${baseTempFolder}/campaign_portfolio/${file.name}`;
        const newPath = `${finalPortfolioFolder}/${file.name}`;

        const { data: fileData, error: downloadErr } = await supabase.storage
          .from("uploads_UAT")
          .download(oldPath);

        if (downloadErr) {
          console.warn(" Portfolio file download failed:", downloadErr.message);
          continue;
        }

        await supabase.storage.from("uploads_UAT").upload(newPath, fileData, { upsert: true });
        await supabase.storage.from("uploads_UAT").remove([oldPath]);
      }
    }

    // ✅ Clean up temp folders and Redis cache
    await supabase.storage.from("uploads_UAT").remove([
      `${baseTempFolder}/campaign_profile`,
      `${baseTempFolder}/campaign_portfolio`,
    ]);

    await redisClient.del(redisKey);

    return res.status(200).json({
      status: true,
      message: p_message,
      campaignId: p_campaignid,
      campaignName: p_campaignname,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ finalizeCampaign error:", error);
    return res.status(500).json({
      status: false,
      message: "Error finalizing campaign",
      error: error.message,
    });
  }
};
// ---------------- GET CAMPAIGN ----------------
export const getCampaign = async (req, res) => {
  try {
    const userId = req.user?.id || req.query.p_userid;
    const campaignId = req.params.campaignId || "01";

    if (!userId)
      return res.status(400).json({ message: "User ID required" });

    const redisKey =
      campaignId === "01"
        ? `getCampaign:${userId}`
        : `getCampaign:${userId}:${campaignId}`;

    // console.log("🧩 getCampaign called with:", { userId, campaignId, redisKey });

    if (campaignId === "01") {
      const cachedData = await redisClient.get(redisKey);

      if (cachedData) {
        return res.status(200).json({
          message: "Draft campaign from Redis",
          campaignParts: cachedData,   // ✔ No JSON.parse
          source: "redis",
        });
      }

      return res.status(200).json({
        message: "No draft found",
        campaignParts: {},
        source: "empty",
      });

    }

    const cachedEditData = await redisClient.get(redisKey);

    if (cachedEditData) {
      return res.status(200).json({
        message: "Campaign data from Redis",
        campaignParts: cachedEditData,  // ✔ No JSON.parse
        source: "redis",
      });
    }

    // console.log("Redis miss → fetching from DB");

    const result = await client.query(
      `SELECT * FROM ins.fn_get_campaigndetailsjson($1::BIGINT, $2::BIGINT)`,
      [userId, campaignId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Campaign not found" });
    }

    const fullData = result.rows[0];

    // Cache DB data in Redis for next time
    await redisClient.set(redisKey, (fullData));

    return res.status(200).json({
      message: "Campaign data from DB",
      campaignParts: fullData,
      source: "db",
    });

  } catch (err) {
    console.error("❌ getCampaign error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const deleteCampaignFile = async (req, res) => {
  try {
    const userId = req.user?.id || req.body.userId;
    const campaignId = req.body.campaignId || null;
    const filePathToDelete = req.body.filepath; // Supabase public file URL
    const bucketName = "uploads_UAT";

    if (!userId || !filePathToDelete) {
      return res.status(400).json({
        status: false,
        message: "userId and filepath are required",
      });
    }

    // ---------------- 1️⃣ Update Redis ----------------
    const redisKey = `getCampaign:${userId}${campaignId ? `:${campaignId}` : ""}`;
    let campaignData = await redisClient.get(redisKey);
    if (campaignData) {
      campaignData = (campaignData);

      // Remove deleted file from Redis cache
      if (campaignData.p_campaignfilejson) {
        campaignData.p_campaignfilejson = campaignData.p_campaignfilejson.filter(
          (file) => file.filepath !== filePathToDelete
        );

        await redisClient.set(redisKey, (campaignData));
      }
    }

    // ---------------- 2️⃣ Convert public URL to relative path ----------------
    const supabaseFilePath = filePathToDelete
      .split(`/storage/v1/object/public/${bucketName}/`)[1]
      ?.trim();

    if (!supabaseFilePath) {
      return res.status(400).json({
        status: false,
        message: "Invalid Supabase file path format",
      });
    }

    // ---------------- 3️⃣ Delete from Supabase Storage ----------------
    const { error: deleteError } = await supabase.storage
      .from(bucketName)
      .remove([supabaseFilePath]);

    if (deleteError) {
      console.error("❌ Supabase delete error:", deleteError.message);
      return res.status(500).json({
        status: false,
        message: "Error deleting file from Supabase",
        error: deleteError.message,
      });
    }

    return res.status(200).json({
      status: true,
      message: "File deleted successfully from Supabase and Redis",
      deletedFile: supabaseFilePath,
      campaignFiles: campaignData?.p_campaignfilejson || [],
    });
  } catch (error) {
    console.error("❌ deleteCampaignFile error:", error);
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

export const getCampaignObjectives = async (req, res) => {
  try {
    const result = await client.query(
      "SELECT * from ins.fn_get_campaignobjectives()"
    );

    return res.status(200).json({
      objectives: result.rows,
      source: "db",
    });
  } catch (error) {
    console.error("Error fetching GetCampaignObjectives:", error);
    return res
      .status(500)
      .json({ message: "Failed to fetch GetCampaignObjectives" });
  }
};


export const getProvidorContentTypes = async (req, res) => {
  try {
    const result = await client.query(
      "SELECT * from ins.fn_get_providercontenttypes();"
    );

    return res.status(200).json({
      providorType: result.rows,
      source: "db",
    });
  } catch (error) {
    console.error("Error fetching GetCampaignObjectives:", error);
    return res
      .status(500)
      .json({ message: "Failed to fetch GetCampaignObjectives" });
  }
}

// export const upsertCampaign = async (req, res) => {
//   try {
//     const p_userid = req.user?.id || req.body.p_userid;
//     const campaignId = req.body.campaignId || null;
//     const isFinalSubmit = req.body.isFinalSubmit || false;
//     const p_statusname = req.body.p_statusname || "Draft";

//     if (!p_userid) {
//       return res.status(400).json({ message: "User ID is required" });
//     }

//     // ---------------- USERNAME RESOLUTION ----------------
//     let username = "user";
//     if (req.user?.firstName || req.user?.lastName) {
//       username = `${req.user.firstName || ""}_${
//         req.user.lastName || ""
//       }`.trim();
//     } else if (req.body?.firstName || req.body?.lastName) {
//       username = `${req.body.firstName || ""}_${
//         req.body.lastName || ""
//       }`.trim();
//     } else {
//       const dbUser = await client.query(
//         "SELECT firstname, lastname FROM ins.users WHERE id=$1",
//         [p_userid]
//       );
//       if (dbUser.rows[0]) {
//         username =
//           `${dbUser.rows[0].firstname || ""}_${
//             dbUser.rows[0].lastname || ""
//           }`.trim() || "user";
//       }
//     }

//     // ---------------- HELPERS ----------------
//     const parseIfJson = (data) => {
//       if (!data) return {};
//       if (typeof data === "string") {
//         try {
//           return JSON.parse(data);
//         } catch {
//           return {};
//         }
//       }
//       return data;
//     };

//     const cleanArray = (arr) => {
//       if (!arr || !Array.isArray(arr)) return [];
//       return arr.filter((item) => item && Object.keys(item).length);
//     };

//     // ---------------- PARSE JSON FIELDS ----------------
//     const p_objectivejson = parseIfJson(req.body.p_objectivejson);
//     const p_vendorinfojson = parseIfJson(req.body.p_vendorinfojson);
//     const p_campaignjson = parseIfJson(req.body.p_campaignjson);
//     const p_campaigncategoyjson = cleanArray(
//       parseIfJson(req.body.p_campaigncategoyjson)
//     );
//     const p_campaignfilejson = cleanArray(
//       parseIfJson(req.body.p_campaignfilejson)
//     );
//     const p_contenttypejson = cleanArray(
//       parseIfJson(req.body.p_contenttypejson)
//     );

//     // ---------------- FILE HANDLING ----------------
//     let campaignPhotoPath = p_campaignjson?.photopath || null;
//     let campaignFiles = [];

//     // Upload main photo
//     if (req.files?.photo?.[0]) {
//       const file = req.files.photo[0];
//       const fileName =file.originalname;
//       const newFileName = `${p_userid}_${username}_campaign_photo_${fileName}`;
//       const campaignFolderPath = `vendors/${p_userid}_${username}/campaigns/campaign_profile`;
//       const supabasePath = `${campaignFolderPath}/${newFileName}`;

//       const fileBuffer = file.buffer;

//       const { error: uploadError } = await supabase.storage
//         .from("uploads_UAT")
//         .upload(supabasePath, fileBuffer, {
//           contentType: file.mimetype,
//           upsert: true,
//         });

//       if (uploadError) {
//         console.error("Upload error:", uploadError.message);
//         throw uploadError;
//       }

//       const { data: publicURL } = supabase.storage
//         .from("uploads_UAT")
//         .getPublicUrl(supabasePath);

//       campaignPhotoPath = publicURL.publicUrl;
//       p_campaignjson.photopath = campaignPhotoPath;
//     }
//     // Upload multiple files
//     if (req.files?.Files?.length > 0) {
//       campaignFiles = await Promise.all(
//         req.files.Files.map(async (file) => {
//           const fileName = file.originalname;
//           const newFileName = `${p_userid}_${username}_portfolio_file_${fileName}`;
//           const filePath = `vendors/${p_userid}_${username}/campaigns/portfolios/${newFileName}`;
//           const fileBuffer = file.buffer;

//           const { error: uploadError } = await supabase.storage
//             .from("uploads_UAT")
//             .upload(filePath, fileBuffer, {
//               contentType: file.mimetype,
//               upsert: true,
//             });

//           if (uploadError)
//             console.warn("⚠️ File upload failed:", uploadError.message);

//           const { data: publicURL } = supabase.storage
//             .from("uploads_UAT")
//             .getPublicUrl(filePath);

//           return { filepath: publicURL.publicUrl };
//         })
//       );
//     }

//     // ---------------- REDIS DRAFT STORAGE ----------------
//     const redisKey = `getCampaign:${p_userid}${
//       campaignId ? `:${campaignId}` : ""
//     }`;

//     // Read existing Redis draft if any
//     let existingDraft = {};
//     const cachedData = await redisClient.get(redisKey);
//     if (cachedData) {
//       existingDraft = JSON.parse(cachedData);
//     }

//     // Merge old + new data
//     const draftData = {
//       p_objectivejson: {
//         ...(existingDraft.p_objectivejson || {}),
//         ...p_objectivejson,
//       },
//       p_vendorinfojson: {
//         ...(existingDraft.p_vendorinfojson || {}),
//         ...p_vendorinfojson,
//       },
//       p_campaignjson: {
//         ...(existingDraft.p_campaignjson || {}),
//         ...p_campaignjson,
//       },
//       p_campaigncategoyjson: p_campaigncategoyjson.length
//         ? p_campaigncategoyjson
//         : existingDraft.p_campaigncategoyjson || [],
//       p_contenttypejson: p_contenttypejson.length
//         ? p_contenttypejson
//         : existingDraft.p_contenttypejson || [],
//       p_campaignfilejson: [
//         ...(existingDraft.p_campaignfilejson || []),
//         ...(p_campaignfilejson || []),
//         ...(campaignFiles || []),
//       ],
//       is_completed: false,
//       updated_at: new Date(),
//     };

//     // Always save to Redis
//     await redisClient.set(redisKey, JSON.stringify(draftData));

//     // If it's only draft saving (not final submit)
//     if (!isFinalSubmit) {
//       return res.status(200).json({
//         status: true,
//         message: "Draft stored in Redis successfully",
//         campaignParts: draftData,
//         source: "redis",
//       });
//     }

//     // ---------------- FINAL SAVE TO DATABASE ----------------
//     const existingDataResult = await client.query(
//       `SELECT * FROM ins.fn_get_campaigndetailsjson($1::BIGINT, $2::BIGINT)`,
//       [p_userid, campaignId]
//     );
//     const existingData = existingDataResult.rows[0] || {};

//     const mergeObjects = (oldObj, newObj) => ({ ...oldObj, ...newObj });

//     const finalData = {
//       p_objectivejson: mergeObjects(
//         existingData.p_objectivejson || {},
//         p_objectivejson
//       ),
//       p_vendorinfojson: mergeObjects(
//         existingData.p_vendorinfojson || {},
//         p_vendorinfojson
//       ),
//       p_campaignjson: mergeObjects(
//         existingData.p_campaignjson || {},
//         p_campaignjson
//       ),
//       p_campaigncategoyjson:
//         p_campaigncategoyjson.length > 0
//           ? p_campaigncategoyjson
//           : existingData.p_campaigncategoyjson || [],
//       p_campaignfilejson:
//         p_campaignfilejson.length || campaignFiles.length
//           ? [
//               ...(existingData.p_campaignfilejson || []),
//               ...p_campaignfilejson,
//               ...campaignFiles,
//             ]
//           : existingData.p_campaignfilejson || [],
//       p_contenttypejson:
//         p_contenttypejson.length > 0
//           ? p_contenttypejson
//           : existingData.p_contenttypejson || [],
//     };

//     // DB Call
//     const result = await client.query(
//       `CALL ins.usp_upsert_campaigndetails(
//         $1::BIGINT, 
//         $2::BIGINT, 
//         $3::varchar, 
//         $4::JSON, 
//         $5::JSON, 
//         $6::JSON, 
//         $7::JSON, 
//         $8::JSON, 
//         $9::JSON, 
//         NULL, 
//         NULL
//       )`,
//       [
//         p_userid,
//         campaignId,
//         p_statusname,
//         JSON.stringify(finalData.p_objectivejson),
//         JSON.stringify(finalData.p_vendorinfojson),
//         JSON.stringify(finalData.p_campaignjson),
//         JSON.stringify(finalData.p_campaigncategoyjson),
//         JSON.stringify(finalData.p_campaignfilejson),
//         JSON.stringify(finalData.p_contenttypejson),
//       ]
//     );

//     const { p_status, p_message, p_campaignid } = result.rows[0] || {};

//     // Delete draft after successful DB save
//     await redisClient.del(redisKey);

//     return res.status(200).json({
//       success: true,
//       message: p_message || "Campaign saved successfully",
//       campaignId: p_campaignid || campaignId,
//       source: "db",
//     });
//   } catch (err) {
//     console.error("❌ upsertCampaign error:", err);
//     return res.status(500).json({
//       success: false,
//       message: "Error processing campaign",
//       error: err.message,
//     });
//   }
// };

export const upsertCampaign = async (req, res) => {
  try {
    const p_userid = req.user?.id || req.body.p_userid;
    const campaignId = req.body.campaignId || null;
    const isFinalSubmit = req.body.isFinalSubmit || false;
    const p_statusname = req.body.p_statusname || "Draft";

    if (!p_userid)
      return res.status(400).json({ message: "User ID is required" });

    // ---------------- USERNAME ----------------
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
      [p_userid]
    );
    if (dbUser.rows[0]?.firstname) {
      username = dbUser.rows[0].firstname.trim();
    }

    }

    // ---------------- HELPERS ----------------
    const parseIfJson = (data) => {
      try {
        return data ? JSON.parse(data) : {};
      } catch {
        return {};
      }
    };
    const cleanArray = (arr) => (Array.isArray(arr) ? arr.filter(Boolean) : []);

    // ---------------- PARSE JSON FIELDS ----------------
    const p_objectivejson = parseIfJson(req.body.p_objectivejson);
    const p_vendorinfojson = parseIfJson(req.body.p_vendorinfojson);
    const p_campaignjson = parseIfJson(req.body.p_campaignjson);
    const p_campaigncategoyjson = cleanArray(req.body.p_campaigncategoyjson);
    const p_campaignfilejson = cleanArray(req.body.p_campaignfilejson);
    const p_contenttypejson = cleanArray(req.body.p_contenttypejson);

    // ---------------- TEMP FOLDERS ----------------
    const baseTempFolder = `Vendor/${p_userid}_${username}/Campaigns/_temp`;
    const tempPhotoFolder = `${baseTempFolder}/campaign_profile`;
    const tempPortfolioFolder = `${baseTempFolder}/campaign_portfolio`;

    let campaignFiles = [];

    // ---------------- UPLOAD MAIN PHOTO ----------------
    if (req.files?.photo?.[0]) {
      const file = req.files.photo[0];
      const newFileName = file.originalname;
      const tempPhotoPath = `${tempPhotoFolder}/${newFileName}`;

      const { error } = await supabase.storage.from("uploads_UAT").upload(
        tempPhotoPath,
        file.buffer,
        { contentType: file.mimetype, upsert: true }
      );
      if (error) throw new Error(`Photo upload failed: ${error.message}`);

      // // ✅ Only store filename in DB
      // p_campaignjson.photopath = newFileName;
      const { data: publicData } = supabase.storage.from("uploads_UAT").getPublicUrl(tempPhotoPath);
        p_campaignjson.photopath = publicData.publicUrl; // store full URL for UI
    }

    // ---------------- UPLOAD PORTFOLIO FILES ----------------
    if (req.files?.Files?.length > 0) {
      for (const file of req.files.Files) {
        const newFileName = file.originalname;
        const tempPortfolioPath = `${tempPortfolioFolder}/${newFileName}`;

        const { error } = await supabase.storage.from("uploads_UAT").upload(
          tempPortfolioPath,
          file.buffer,
          { contentType: file.mimetype, upsert: true }
        );
        if (error) console.warn("⚠️ File upload failed:", error.message);

        // // ✅ Only store filename in DB
        // campaignFiles.push({ filepath: newFileName });
        const { data: publicData } = supabase.storage.from("uploads_UAT").getPublicUrl(tempPortfolioPath);
        campaignFiles.push({filepath: publicData.publicUrl });
      }
    }

    // ---------------- REDIS DRAFT HANDLING ----------------
    const redisKey = `getCampaign:${p_userid}${campaignId ? `:${campaignId}` : ""}`;
    let existingDraft = {};
    const cached = await redisClient.get(redisKey);

    // ❌ if (cached) existingDraft = JSON.parse(cached);
    // ✔ Direct assign
    if (cached) existingDraft = cached;


    const draftData = {
      p_objectivejson: { ...(existingDraft.p_objectivejson || {}), ...p_objectivejson },
      p_vendorinfojson: { ...(existingDraft.p_vendorinfojson || {}), ...p_vendorinfojson },
      p_campaignjson: { ...(existingDraft.p_campaignjson || {}), ...p_campaignjson },
      p_campaigncategoyjson: p_campaigncategoyjson.length
        ? p_campaigncategoyjson
        : existingDraft.p_campaigncategoyjson || [],
      p_contenttypejson: p_contenttypejson.length
        ? p_contenttypejson
        : existingDraft.p_contenttypejson || [],
      p_campaignfilejson: [
        ...(existingDraft.p_campaignfilejson || []),
        ...(p_campaignfilejson || []),
        ...(campaignFiles || []),
      ],
      updated_at: new Date(),
    };

   await redisClient.set(redisKey, draftData);

    // ---------------- DRAFT SAVE ONLY ----------------
    if (!isFinalSubmit) {
      return res.status(200).json({
        status: true,
        message: "Draft stored in Redis successfully",
        campaignParts: draftData,
      });
    }
    
    // DB Call for edit only startdate and enddate 

    const result = await client.query(
      `CALL ins.usp_upsert_campaigndetails(
        $1::BIGINT, 
        $2::BIGINT, 
        $3::varchar, 
        $4::JSON, 
        $5::JSON, 
        $6::JSON, 
        $7::JSON, 
        $8::JSON, 
        $9::JSON,
        $10::boolean,
        $11::TEXT,
        $12::TEXT
      )`,
      [
        p_userid,
        campaignId,
        p_statusname,
        p_objectivejson||null ,
        p_vendorinfojson||null ,
        req.body.p_campaignjson,
        p_campaigncategoyjson||null,
        p_campaignfilejson||null,
        p_contenttypejson||null,
        null,
        null,
        null
      ]
    );

    const { p_status, p_message, p_campaignid } = result.rows[0];

    return res.status(200).json({
      success: p_status,
      message: p_message ,
      campaignId: p_campaignid,
      source: "db",
    });
  } catch (err) {
    console.error("❌ upsertCampaign error:", err);
    return res.status(500).json({
      success: false,
      message: "Error processing campaign",
      error: err.message,
    });
  }
};