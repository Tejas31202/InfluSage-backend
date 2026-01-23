import { client } from '../../config/Db.js';
import { createClient } from "@supabase/supabase-js";
import Redis from '../../utils/RedisWrapper.js';
import { HTTP, SP_STATUS } from '../../utils/Constants.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ---------------- FINALIZE Campaign ----------------
const MAX_PROFILEPHOTO_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_PORTFOLIO_FILE_SIZE = 25 * 1024 * 1024; // 25 MB
export const finalizeCampaign = async (req, res) => {
  try {
    const userId = req.user?.id || req.body.p_userid;
    const campaignId = req.body.p_campaignid || null;
    const p_statusname = req.body.p_statusname;

    if (!userId) return res.status(HTTP.BAD_REQUEST).json({ message: "User ID is required" });

    const redisKey = campaignId ? `getCampaign:${userId}:${campaignId}` : `getCampaign:${userId}`;
    let cachedData = await Redis.get(redisKey);
    cachedData = typeof cachedData === "string" ? JSON.parse(cachedData) : cachedData;

    if (!cachedData) return res.status(HTTP.NOT_FOUND).json({
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

    if (p_status === SP_STATUS.SUCCESS) {
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

      return res.status(HTTP.OK).json({
        status: true,
        message: p_message || "Campaign finalized successfully",
        campaignId: finalCampaignId,
        source: "db",
      });
    }

    else if (p_status === SP_STATUS.VALIDATION_FAIL) return res.status(HTTP.BAD_REQUEST).json({ status: false, message: p_message || "Validation failed", source: "db" });
    else if (p_status === SP_STATUS.ERROR) return res.status(HTTP.INTERNAL_ERROR).json({ status: false, message: p_message || "Something went wrong while finalizing campaign" });
    else return res.status(HTTP.INTERNAL_ERROR).json({ status: false, message: "Unexpected database response" });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("finalizeCampaign error:", error);
    return res.status(HTTP.INTERNAL_ERROR).json({ message: "Something went wrong. Please try again later.", error: error.message });
  }
};

// ---------------- GET CAMPAIGN ----------------
export const getCampaign = async (req, res) => {
  try {
    const userId = req.user?.id || req.query.p_userid;
    const campaignId = req.query.campaignId || "01";
    if (!userId) return res.status(HTTP.BAD_REQUEST).json({ message: "User ID required" });

    const redisKey = campaignId === "01" ? `getCampaign:${userId}` : `getCampaign:${userId}:${campaignId}`;
    let cachedData = await Redis.get(redisKey);
    cachedData = typeof cachedData === "string" ? JSON.parse(cachedData) : cachedData;

    if (cachedData) return res.status(HTTP.OK).json({ message: campaignId === "01" ? "Draft campaign from Redis" : "Campaign data from Redis", campaignParts: cachedData, source: "redis" });

    const result = await client.query(`SELECT * FROM ins.fn_get_campaigndetailsjson($1::BIGINT, $2::BIGINT)`, [userId, campaignId]);
    if (result.rows.length === 0) return res.status(HTTP.NOT_FOUND).json({ message: "Campaign not found" });

    const fullData = result.rows[0];
    await Redis.setEx(redisKey, 3600, fullData);

    return res.status(HTTP.OK).json({ message: "Campaign data from DB", campaignParts: fullData, source: "db" });
  } catch (error) {
    console.error("Error in getCampaign:", error);
    return res.status(HTTP.INTERNAL_ERROR).json({ message: "Something went wrong. Please try again later.", error: error.message });
  }
};

// ---------------- DELETE FILE ----------------
export const deleteCampaignFile = async (req, res) => {
  try {
    const userId = req.user?.id || req.body.userId;
    const campaignId = req.body.campaignId || null;
    const filePathToDelete = req.body.filepath;
    const bucketName = process.env.SUPABASE_BUCKET;

    if (!userId || !filePathToDelete) return res.status(HTTP.BAD_REQUEST).json({ status: false, message: "userId and filepath are required" });

    const redisKey = campaignId ? `getCampaign:${userId}:${campaignId}` : `getCampaign:${userId}`;
    let campaignData = await Redis.get(redisKey);
    campaignData = typeof campaignData === "string" ? JSON.parse(campaignData) : campaignData;

    if (campaignData?.p_campaignfilejson?.length) {
      const requestFileName = filePathToDelete.split("/").pop();
      campaignData.p_campaignfilejson = campaignData.p_campaignfilejson.filter(file => file.filepath.split("/").pop() !== requestFileName);
      await Redis.setEx(redisKey, 3600, campaignData);
    }

    const supabaseFilePath = filePathToDelete.split(`/storage/v1/object/public/${bucketName}/`)[1]?.trim();
    if (!supabaseFilePath) return res.status(HTTP.BAD_REQUEST).json({ status: false, message: "Invalid Supabase file path format" });

    const { error: deleteError } = await supabase.storage.from(bucketName).remove([supabaseFilePath]);
    if (deleteError) return res.status(HTTP.INTERNAL_ERROR).json({ status: false, message: "Error deleting file from Supabase", error: deleteError.message });

    return res.status(HTTP.OK).json({ status: true, message: "File deleted successfully from Supabase and Redis", deletedFile: supabaseFilePath, campaignFiles: campaignData?.p_campaignfilejson || [] });
  } catch (error) {
    console.error("error in deleteCampaignFile:", error);
    return res.status(HTTP.INTERNAL_ERROR).json({ message: "Something went wrong. Please try again later.", error: error.message });
  }
};

// ---------------- GET OBJECTIVES ----------------
export const getCampaignObjectives = async (req, res) => {
  try {
    const result = await client.query("SELECT * from ins.fn_get_campaignobjectives()");
    return res.status(HTTP.OK).json({ objectives: result.rows, source: "db" });
  } catch (error) {
    console.error("Error fetching GetCampaignObjectives:", error);
    return res.status(HTTP.INTERNAL_ERROR).json({ message: "Something went wrong. Please try again later.", error: error.message });
  }
};

// ---------------- GET PROVIDER CONTENT TYPES ----------------
export const getProvidorContentTypes = async (req, res) => {
  try {
    const result = await client.query("SELECT * from ins.fn_get_providercontenttypes();");
    return res.status(HTTP.OK).json({ providorType: result.rows, source: "db" });
  } catch (error) {
    console.error("Error fetching getProvidorContentTypes:", error);
    return res.status(HTTP.INTERNAL_ERROR).json({ message: "Something went wrong. Please try again later.", error: error.message });
  }
};

// ---------------- UPSERT CAMPAIGN ----------------
export const upsertCampaign = async (req, res) => {
  try {
    const p_userid = req.user?.id || req.body.p_userid;
    const campaignId = req.body.campaignId || null;
    const isFinalSubmit = req.body.isFinalSubmit || false;
    const p_statusname = req.body.p_statusname || null;

    if (!p_userid) return res.status(HTTP.BAD_REQUEST).json({ message: "User ID is required" });

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
      if (file.size > MAX_PROFILEPHOTO_SIZE) {
        return res
          .status(HTTP.BAD_REQUEST)
          .json({ message: `Profile photo exceeds maximum size of 5 MB` });
      }
      const { error } = await supabase.storage.from(process.env.SUPABASE_BUCKET).upload(tempPhotoPath, file.buffer, { contentType: file.mimetype, upsert: true });
      if (error) throw new Error(`Photo upload failed: ${error.message}`);
      const { data: publicData } = supabase.storage.from(process.env.SUPABASE_BUCKET).getPublicUrl(tempPhotoPath);
      p_campaignjson.photopath = publicData.publicUrl;
    }

    // Upload portfolio files
    if (req.files?.Files?.length > 0) {
      for (const file of req.files.Files) {
        const tempPortfolioPath = `${tempPortfolioFolder}/${file.originalname}`;
        if (file.size > MAX_PORTFOLIO_FILE_SIZE) {
          return res
            .status(HTTP.BAD_REQUEST)
            .json({ message: `Portfolio file ${file.originalname} exceeds maximum size of 25 MB` });
        }
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

    if (!isFinalSubmit) return res.status(HTTP.OK).json({ status: true, message: "Draft stored in Redis successfully", campaignParts: draftData, source: "redis" });

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

    if (p_status === SP_STATUS.SUCCESS) await Redis.del(redisKey);

    return p_status === SP_STATUS.SUCCESS
      ? res.status(HTTP.OK).json({ status: true, message: p_message || "Campaign saved successfully", campaignId: finalCampaignId, source: "db" })
      : p_status === SP_STATUS.VALIDATION_FAIL
        ? res.status(HTTP.BAD_REQUEST).json({ status: false, message: p_message || "Validation failed", source: "db" })
        : res.status(HTTP.INTERNAL_ERROR).json({ status: false, message: "Something went wrong while saving campaign" });

  } catch (error) {
    console.error("error in upsertCampaign:", error);
    return res.status(HTTP.INTERNAL_ERROR).json({ message: "Something went wrong. Please try again later.", error: error.message });
  }
};
