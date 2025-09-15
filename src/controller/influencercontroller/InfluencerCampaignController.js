import { client } from '../../config/Db.js';

import redis from 'redis';

const redisClient = redis.createClient({ url: process.env.REDIS_URL });
redisClient.connect().catch(console.error);

//For Selected Camapign Details
export const getCampaignDetails = async (req, res) => {
  try {
    const { campaignId } = req.params;

    const result = await client.query(
      "select * from ins.fn_get_campaignbrowsedetails($1)",
      [campaignId]
    );

    //Check From DB Not Found Campaign
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Campaign not found." });
    }

    const campaignDetails = result.rows[0].fn_get_campaignbrowsedetails;

    return res.status(200).json({ data: campaignDetails, source: "db" });
  } catch (error) {
    console.error("Error fetching campaign details:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

//For Apply Campaign
export const applyNowCampaign = async (req, res) => {
  try {
    const userId = req.user?.id || req.body.userId;
    const campaignId = req.params.campaignId;
    const redisKey = `applyCampaign:${userId}`;

    // Parse JSON from form-data
    let applycampaignjson = {};
    if (req.body.applycampaignjson) {
      try {
        applycampaignjson = JSON.parse(req.body.applycampaignjson);
      } catch (err) {
        return res
          .status(400)
          .json({ message: "Invalid applycampaignjson format" });
      }
    }
    if (req.files && req.files.portfolioFiles) {
      const uploadedFiles = req.files.portfolioFiles.map((file) => {
        // normalize Windows paths -> forward slashes
        const cleanPath = file.path.replace(/\\/g, "/");

        // Instead of saving "src/uploads..." save as relative "/uploads/..."
        const relativePath = cleanPath.replace("src/", "/");

        return { filepath: relativePath };
      });

      // Merge old + new files
      if (
        applycampaignjson.filepaths &&
        Array.isArray(applycampaignjson.filepaths)
      ) {
        applycampaignjson.filepaths = [
          ...applycampaignjson.filepaths,
          ...uploadedFiles,
        ];
      } else {
        applycampaignjson.filepaths = uploadedFiles;
      }
    }
    // Save in DB
    const result = await client.query(
      `CALL ins.usp_insert_campaignapplication(
          $1::bigint,
          $2::bigint,
          $3::json,
          $4::boolean,
          $5::text
      )`,
      [userId, campaignId, JSON.stringify(applycampaignjson), null, null]
    );

    const { p_status, p_message } = result.rows[0];

    if (p_status) {
      await redisClient.del(redisKey);
      return res.status(200).json({
        message: p_message || "Application saved successfully",
        source: "db",
      });
    } else {
      return res.status(400).json({ message: p_message });
    }
  } catch (error) {
    console.error("Error applying to campaign:", error);
    return res.status(500).json({ message: error.message });
  }
};

//For Applied Campaign
export const getUsersAppliedCampaigns = async (req, res) => {
  try {
    const userId = req.user?.id || req.body.userId;
    const {
      p_sortby = "createddate",
      p_sortorder = "DESC",
      p_pagenumber = 1,
      p_pagesize = 20,
      p_search,
    } = {
      ...req.query,
      ...req.params,
    };
    const redisKey = `applyCampaign:${userId}:${p_sortby}:${p_sortorder}:${p_pagenumber}:${p_pagesize}`;

    //Try Cache First From Redis
    const cachedData = await redisClient.get(redisKey);
    if (cachedData) {
      return res.status(200).json({
        data: JSON.parse(cachedData),
        source: "redis",
      });
    }

    //If Not In Redis → Fetch From DB (don't save in Redis)
    const result = await client.query(
      `SELECT * FROM ins.fn_get_campaignapplication(
      $1::bigint,
      $2::text,
      $3::text,
      $4::int,
      $5::int,
      $6::text)`,

      [userId, p_sortby, p_sortorder, p_pagenumber, p_pagesize, p_search]
    );

    //Check Db Return Data OR Not
    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ message: "No applied campaigns found." });
    }

    //Return Data From Db
    return res.status(200).json({
      data: result.rows[0].fn_get_campaignapplication,
      source: "db",
    });
  } catch (error) {
    console.error("Error fetching applied campaigns:", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

//For Save Campaign
export const saveCampaign = async (req, res) => {
  try {
    const userId = req.user?.id || req.body.userId;
    const campaignId = req.params.campaignId;

    if (!campaignId || !userId) {
      return res
        .status(400)
        .json({ message: "User ID and Campaign ID are required." });
    }

    const SaveCampaign = await client.query(
      `CALL ins.usp_insert_campaignsave($1::bigint,$2::bigint, $3, $4)`,
      [userId, campaignId, null, null]
    );

    const { p_message } = SaveCampaign.rows[0];
    return res.status(201).json({
      message: p_message,
    });
  } catch (error) {
    console.error("Error saving campaign application:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

//For Get Save Camapign
export const getSaveCampaign = async (req, res) => {
  try {
    const userId = req.user?.id || req.body.userId;
    if (!userId) {
      return res.status(400).json({ message: "User Id Required." });
    }

    const { sortby, sortorder, pagenumber, pagesize, p_search } = req.query;

    const result = await client.query(
      `SELECT * FROM ins.fn_get_campaignsave(
      $1:: BIGINT,
      $2:: text,
      $3:: text,
      $4:: integer,
      $5:: integer,
      $6:: text 
      )`,
      [
        userId || null,
        sortby || "createddate",
        sortorder || "DESC",
        pagenumber || 1,
        pagesize || 20,
        p_search,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Campaign not found." });
    }

    const savedcampaign = result.rows[0]?.fn_get_campaignsave;

    return res.status(200).json({ data: savedcampaign, source: "db" });
  } catch (error) {
    console.error("Error saving campaign application:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

//For Apply Single Campaign
export const getSingleApplyCampaign = async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;
    const { campaignId } = req.params;
    const redisKey = `applyCampaign:${userId}:${campaignId}`;

    // 1️⃣ Try cache first
    const cachedData = await redisClient.get(redisKey);
    if (cachedData) {
      return res.status(200).json({
        data: JSON.parse(cachedData),
        source: "redis",
      });
    }

    // 2️⃣ If not in Redis → fetch from DB (❌ don't save in Redis)
    const result = await client.query(
      `SELECT ins.fn_get_campaignapplicationdetails($1,$2)`,
      [userId, campaignId]
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ message: "No applied campaigns found." });
    }

    // 3️⃣ Just return DB response directly
    return res.status(200).json({
      data: result.rows[0]?.fn_get_campaignapplicationdetails,
      source: "db",
    });
  } catch (error) {
    console.error("Error fetching applied campaigns:", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

//For Get user Campign With Details
export const getUserCampaignWithDetails = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { campaignId } = req.params;

    if (!userId || !campaignId) {
      return res
        .status(400)
        .json({ message: "UserId and CampaignId are required." });
    }

    let responseData = {
      campaignDetails: null,
      appliedDetails: null,
    };

    // 1️⃣ Get campaign details (from DB)
    const campaignResult = await client.query(
      "SELECT * FROM ins.fn_get_campaignbrowsedetails($1)",
      [campaignId]
    );

    if (campaignResult.rows.length > 0) {
      responseData.campaignDetails =
        campaignResult.rows[0].fn_get_campaignbrowsedetails;
    }

    // 2️⃣ Get applied campaign details (check Redis first)
    const redisKey = `applyCampaign:${userId}:${campaignId}`;
    const cachedData = await redisClient.get(redisKey);

    if (cachedData) {
      responseData.appliedDetails = JSON.parse(cachedData);
    } else {
      const appliedResult = await client.query(
        `SELECT ins.fn_get_campaignapplicationdetails($1,$2)`,
        [userId, campaignId]
      );

      if (appliedResult.rows && appliedResult.rows.length > 0) {
        responseData.appliedDetails =
          appliedResult.rows[0].fn_get_campaignapplicationdetails;
      }
    }

    // 3️⃣ Return combined response
    return res.status(200).json({ data: responseData });
  } catch (error) {
    console.error("❌ Error fetching campaign with details:", error.message);
    return res
      .status(500)
      .json({ status: false, message: "Internal Server Error" });
  }
};

//For Browse Campaigns
export const browseCampaigns = async (req, res) => {
  try {
    const userId = req.user?.id || req.body.userId;

    const {
      providers,
      contenttypes,
      languages,
      maxbudget,
      minbudget,
      sortby,
      sortorder,
      pagenumber,
      pagesize,
      p_search,
    } = req.query;

    const result = await client.query(
      `SELECT * FROM ins.fn_get_campaignbrowse(
        $1:: BIGINT,
        $2::json,
        $3::json,
        $4::json,
        $5::numeric,
        $6::numeric,
        $7::text,
        $8::text,
        $9::integer,
        $10::integer,
        $11::text
      )`,
      [
        userId || null,
        providers || null,
        contenttypes || null,
        languages || null,
        maxbudget || null,
        minbudget || null,
        sortby || "createddate",
        sortorder || "DESC",
        pagenumber || 1,
        pagesize || 20,
        p_search,
      ]
    );

    return res.json(result.rows[0]);
  } catch (error) {
    console.error("Error browsing campaigns:", error.message);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
