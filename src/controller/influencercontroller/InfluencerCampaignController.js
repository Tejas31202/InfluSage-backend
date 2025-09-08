import { client } from '../../config/db.js';

import redis from 'redis';

const redisClient = redis.createClient({ url: process.env.REDIS_URL });
redisClient.connect().catch(console.error);


// For All Campaign Details
export const GetAllCampaign = async (req, res) => {
  try {

    // For Converting Data String Into Int Float etc
    const p_providerid = req.query.p_providerid ? parseInt(req.query.p_providerid, 10) : null;
    const p_contenttype = req.query.p_contenttype ? parseInt(req.query.p_contenttype, 10) : null;
    const p_language = req.query.p_language ? parseInt(req.query.p_language, 10) : null;
    const p_maxbudget = req.query.p_maxbudget ? parseFloat(req.query.p_maxbudget) : null;
    const p_minbudget = req.query.p_minbudget ? parseFloat(req.query.p_minbudget) : null;

    // console.log('Input params:', { p_providerid, p_contenttype, p_language, p_maxbudget, p_minbudget });

    //Get Data From DB
    const result = await client.query(
      `SELECT ins.fn_get_campaignbrowse($1, $2::smallint, $3, $4, $5)`,
      [p_providerid, p_contenttype, p_language, p_maxbudget, p_minbudget]
    );

    // console.log('DB result:', result.rows);

    const data = result.rows[0];
    // console.log("===>",data)

    if (!data) {
      return res.status(404).json({ message: 'Campaign not found.' });
    }

    return res.status(200).json({
      data,
      source: 'db'
    });

  } catch (error) {
    console.error('Error fetching Camapign Details:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

//For Selected Camapign Details
export const GetCampaignDetails = async (req, res) => {

  try {

    const { campaignId } = req.params;

    const result = await client.query(
      'select * from ins.fn_get_campaignbrowsedetails($1)',
      [campaignId]
    );

    //Check From DB Not Found Campaign
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Campaign not found.' });
    }


    const campaignDetails = result.rows[0];

    return res.status(200).json({ data: campaignDetails, source: 'db' });

  } catch (error) {

    console.error('Error fetching campaign details:', error);
    res.status(500).json({ message: 'Internal Server Error' });

  }
}

//For Apply Campaign
export const ApplyNowCampaign = async (req, res) => {
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
        return res.status(400).json({ message: "Invalid applycampaignjson format" });
      }
    }
    // Handle uploaded portfolio files
    if (req.files && req.files.portfolioFiles) {
      const uploadedFiles = req.files.portfolioFiles.map((file) => {
        // normalize Windows paths -> forward slashes
        const cleanPath = file.path.replace(/\\/g, "/");

        // Instead of saving "src/uploads..." save as relative "/uploads/..."
        const relativePath = cleanPath.replace("src/", "/");

        return { filepath: relativePath };
      });

      // Merge into filepaths array (override or push)
      applycampaignjson.filepaths = uploadedFiles;
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
      [
        userId,
        campaignId,
        JSON.stringify(applycampaignjson),
        null,
        null
      ]
    );

    const { p_status, p_message } = result.rows[0];

    if (p_status) {
      await redisClient.del(redisKey);
      return res.status(200).json({
        message: p_message || "Application saved successfully",
        source: "db",
        data: applycampaignjson
      });
    } else {
      return res.status(400).json({ message: p_message });
    }
  } catch (error) {
    console.error("Error applying to campaign:", error);
    return res.status(500).json({ message: error.message });
  }
};


export const GetUsersAppliedCampaigns = async (req, res) => {
  try {
    const { userId } = req.params;
    const redisKey = `applyCampaign:${userId}`;

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
      `SELECT * FROM ins.fn_get_campaignapplication($1::bigint)`,
      [userId]
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ message: "No applied campaigns found." });
    }

    // 3️⃣ Just return DB response directly
    return res.status(200).json({
      data: result.rows,
      source: "db",
    });
  } catch (error) {
    console.error("Error fetching applied campaigns:", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

//For Save Campaign
export const SaveCampaign = async (req, res) => {

  try {

    const { campaignId, userId } = req.body;

    if (!campaignId || !userId) {
      return res.status(400).json({ message: 'User ID and Campaign ID are required.' });
    }

    //comment (// const CheckCampaign = await client.query(`SELECT * FROM ins.fn_get_campaignsave($1)`, [userid])

    // //Check Campaign Available and also Check If Available Campaign Same or Not
    // const alreadySaved = CheckCampaign.rows.some(
    //     (row) => row.campaignid === campaignid && row.applied === true
    // );

    // if (alreadySaved) {
    //     return res.status(200).json({ message: 'You have already save to this campaign.' });
    // })

    const SaveCampaign = await client.query(`CALL ins.usp_insert_campaignsave($1::bigint,$2::bigint, $3, $4)`, [userId, campaignId, null, null]);

    return res.status(201).json({
      message: 'Campaign application saved successfully.',
      data: SaveCampaign.rows[0],
      source: 'db'
    });

  } catch (error) {
    console.error('Error saving campaign application:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}

//For Get Save Camapign
export const GetSaveCampaign = async (req, res) => {

  try {

    const { userId } = req.params;
    if (!userId) {

      return res.status(400).json({ message: "User Id Required." })
    }
    const result = await client.query(`SELECT * FROM ins.fn_get_campaignsave($1)`, [userId])

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Campaign not found.' });
    }


    const savedcampaign = result.rows[0];

    return res.status(200).json({ data: savedcampaign, source: 'db' });

  } catch (error) {
    console.error('Error saving campaign application:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }

}


export const GetSingleApplyCampaign = async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;
    const { campaignId } = req.params
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
      data: result.rows,
      source: "db",
    });
  } catch (error) {
    console.error("Error fetching applied campaigns:", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};


export const GetUserCampaignWithDetails = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { campaignId } = req.params;

    if (!userId || !campaignId) {
      return res.status(400).json({ message: "UserId and CampaignId are required." });
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
      responseData.campaignDetails = campaignResult.rows[0];
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
        responseData.appliedDetails = appliedResult.rows;
      }
    }

    // 3️⃣ Return combined response
    return res.status(200).json({
      status: true,
      data: responseData,
    });
  } catch (error) {
    console.error("❌ Error fetching campaign with details:", error.message);
    return res.status(500).json({ status: false, message: "Internal Server Error" });
  }
};


// Browse Campaigns
export const browseCampaigns = async (req, res) => {
  try {
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
    } = req.query;

    
    const result = await client.query(
      `SELECT * FROM ins.fn_get_campaignbrowse(
        $1::json,
        $2::json,
        $3::json,
        $4::numeric,
        $5::numeric,
        $6::text,
        $7::text,
        $8::integer,
        $9::integer
      )`,
      [
        providers || null,
        contenttypes || null,
        languages || null,
        maxbudget || null,
        minbudget || null,
        sortby || "createddate",
        sortorder || "DESC",
        pagenumber || 1,
        pagesize || 20,
      ]
    );

    return res.json(result.rows[0]); // function json return करता है
  } catch (error) {
    console.error("Error browsing campaigns:", error.message);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

