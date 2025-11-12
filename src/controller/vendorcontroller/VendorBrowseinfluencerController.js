import { client } from '../../config/Db.js';
import redis from 'redis';

const redisClient = redis.createClient({ url: process.env.REDIS_URL });
redisClient.connect().catch(console.error);

//..................GET INFLUENCER BROWSE DETAILS...........
export const getInfluencerBrowseDetails = async (req, res) => {
  try {
    const userId=req.user?.id||req.body.userId
    const influencerId = req.params.influencerId;

    if (!influencerId) {
      return res.status(400).json({ message: "Influencer ID required" });
    }

    //Data Given Form DB
    const result = await client.query(
      `SELECT * FROM ins.fn_get_influencerbrowsedetails($1::bigint,$2::bigint);`,
      [userId,influencerId]
    );

    const influencer = result.rows[0]?.fn_get_influencerbrowsedetails[0];

    return res.status(200).json({
      message: "Influencers Browse Details Form DB",
      result:influencer,
      source: "db",
    });
  } catch (error) {
    console.log("getInfluencerBrowseDetails error:", error);
    return res.status(500).json({ message: "Internal server Error" });
  }
};
//..................BROWSE ALL INFLUENCER...............
export const browseAllInfluencer = async (req, res) => {
  try {
    const userId = req.user?.id || req.body.p_userid ;

    const {
      p_location,
      p_providers,
      p_influencertiers,
      p_ratings ,
      p_genders,
      p_languages,
      p_pagenumber,
      p_pagesize,
      p_search
    } = req.query;
  
    const result = await client.query(
      `SELECT * FROM ins.fn_get_influencerbrowse(
    $1::BIGINT,
    $2::TEXT,
    $3::JSON,
    $4::JSON,
    $5::JSON,
    $6::JSON,
    $7::JSON,
    $8::INTEGER,
    $9::INTEGER,
    $10::TEXT
  )`,
      [
        userId,
        p_location||null,
        p_providers||null,
        p_influencertiers||null,
        p_ratings||null ,
        p_genders||null ,
        p_languages||null,
        p_pagenumber || 1,
        p_pagesize || 20,
        p_search||null,
      ]
    );

    
    const influencers = result.rows[0].fn_get_influencerbrowse;

    if (influencers.length === 0) {
      return res.status(404).json({ message: "No influencers found." });
    }

    return res.status(200).json({
      message: "Influencers Get Sucessfully",
      data: influencers,
      source: "db",
    });
  } catch (error) {
    console.log("Failed to Get Influencers sucessfully", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};
//................Add Favourite Influencer................
export const addFavouriteInfluencer = async (req, res) => {
   const userId = req.user?.id;  // ||  req.body.userId;
  const { p_influencerId } = req.body;

  if (!userId) {
    return res.status(400).json({
      status: false,
      message: "Missing userId",
    });
  }
  
  if (!p_influencerId) {
    return res.status(400).json({
      status: false,
      message: "Missing InfluencerId",
    });
  }

  try {
    const result = await client.query(
      `CALL ins.usp_insert_influencersave(
        $1::bigint,
        $2::bigint,
        $3::boolean,
        $4::text
      )`,
      [userId, p_influencerId, null, null]
    );

    const { p_status, p_message } = result.rows[0];

    return res.status(200).json({
      status: p_status,
      message: p_message,
    });
  } catch (error) {
    console.error("Error adding favourite influencer:", error);
    return res.status(500).json({
      status: false,
      message: "Internal server error",
    });
  }
};
//...............Get Favourite Influencer.................
export const getFavouriteInfluencer = async (req, res) => {
  const { userId, p_pagenumber, p_pagesize, p_search } = req.query;

  if (!userId) return res.status(400).json({ message: "Userid Require" });

  try {
    const result = await client.query(
      `SELECT * FROM ins.fn_get_influencersave($1::BIGINT,$2,$3,$4)`,
      [userId, p_pagenumber || 1, p_pagesize || 20, p_search]
    );

    const influencers = result.rows[0]?.fn_get_influencersave;

    return res.json({
      status: true,
      data: influencers,
    });
  } catch (error) {
    console.log("Error While Favourite Influencer Get", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
//...............InviteInfluencerCampaign.................
export const inviteInfluencerToCampaigns = async (req, res) => {
  const userId = req.user?.id || req.body.userId;
  const { p_influencerid } = req.query;

  if (!p_influencerid) {
    return res.status(400).json({ message: "Influencer Id require." });
  }

  try {
    const result = await client.query(
      `SELECT * FROM ins.fn_get_vendorcampaignlistforInvitation($1::BIGINT,$2::BIGINT)`,
      [p_influencerid, userId]
    );

    const campaigns = result.rows[0].p_campaigns;

    return res.status(200).json({
      data: campaigns,
      source: "db",
    });
  } catch (error) {
    console.error("Error While Fetching Campaign", error);
    return res
      .status(500)
      .json({ message: "internal Server error While Fetching Campaign" });
  }
};
//..............InsertCampaignInvites........................
export const insertCampaignInvites = async (req, res) => {
  const { p_influencerid, p_campaignidjson } = req.body;

  if (!p_influencerid) {
    return res.status(400).json({
      message: "Influencerid Id Require",
    });
  }
  if (!p_campaignidjson || p_campaignidjson.length === 0) {
    return res.status(400).json({
      message: "No Campaign selected. Please Selected One Campaign.",
    });
  }

  try {
    const result = await client.query(
      `CALL ins.usp_upsert_campaigninvites(
        $1::bigint,
        $2::json,
        $3::boolean,
        $4::text
       )`,
      [
        p_influencerid,
        p_campaignidjson ? JSON.stringify(p_campaignidjson) : null,
        null,
        null,
      ]
    );

    const { p_status, p_message } = result.rows[0];

    if (p_status) {
      return res
        .status(200)
        .json({ message: p_message, p_status, source: "db" });
    } else {
      return res.status(400).json({ message: p_message, p_status });
    }
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: error.message });
  }
};
//..............Browse Invite Influencer......................
export const browseInviteInfluencer = async (req, res) => {
  const userId = req.user?.id || req.body.userId;
  const { p_pagenumber, p_pagesize, p_search } = req.query;

  try {
    const result = await client.query(
      `SELECT * FROM ins.fn_get_influencerinvite(
      $1::bigint,
      $2::integer,
      $3::integer,
      $4::text)`,
      [userId, p_pagenumber || 1, p_pagesize || 20, p_search || null]
    );

    const influencer = result.rows[0]?.fn_get_influencerinvite;

    return res.status(200).json({
      data: influencer,
      source: "db",
    });
  } catch (error) {
    console.error("Error fetching influencer invites:", error);
    return res.status(500).json({ message: error.message });
  }
};
