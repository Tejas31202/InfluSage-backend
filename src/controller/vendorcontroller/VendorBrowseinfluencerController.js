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
    console.error("error in getInfluencerBrowseDetails:", error);
    return res.status(500).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
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
    console.error("error in browseAllInfluencer:", error);
    return res.status(500).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};
//................Add Favourite Influencer................
export const addFavouriteInfluencer = async (req, res) => {
   const userId = req.user?.id;  // ||  req.body.userId;
  const { p_influencerId } = req.body;

  if (!userId) {
    return res.status(400).json({
      message: "userId is required",
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
        $3::smallint,
        $4::text
      )`,
      [userId, p_influencerId, null, null]
    );

    const row = result.rows?.[0] || {};
    const p_status = Number(row.p_status);
    const p_message = row.p_message;

    // -------------------------------
    //  HANDLE p_status
    // -------------------------------
    if (p_status === 1) {
      return res.status(200).json({
        status: true,
        message: p_message || "Influencer added to favourites",
      });
    } else if (p_status === 0) {
      return res.status(400).json({
        status: false,
        message: p_message || "Validation failed",
      });
    } else if (p_status === -1) {
      console.error("Stored Procedure Failure:", p_message);
      return res.status(500).json({
        status: false,
        message: "Something went wrong. Please try again later.",
      });
    } else {
      return res.status(500).json({
        status: false,
        message: "Unexpected database response",
      });
    }

  } catch (error) {
    console.error("Error in addFavouriteInfluencer:", error);
    return res.status(500).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
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
    return res.status(500).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
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
    console.error("Error in inviteInfluencerToCampaigns:", error);
    return res.status(500).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};
//..............InsertCampaignInvites........................
export const insertCampaignInvites = async (req, res) => {
  const userId = req.user?.id || req.body.userId;
  const { p_influencerid, p_campaignidjson } = req.body;

  if (!userId) {
    return res.status(401).json({
      status: false,
      message: "Unauthorized: user not found",
    });
  }
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
    await client.query("BEGIN");
    await client.query(
      "SELECT set_config('app.current_user_id', $1, true)",
      [String(userId)]
    );
    const result = await client.query(
      `CALL ins.usp_upsert_campaigninvites(
        $1::bigint,
        $2::json,
        $3::smallint,
        $4::text
       )`,
      [
        p_influencerid,
        p_campaignidjson ? JSON.stringify(p_campaignidjson) : null,
        null,
        null,
      ]
    );
    await client.query("COMMIT");

    const row = result.rows[0] || {};
    const p_status = Number(row.p_status);
    const p_message = row.p_message;

    if (p_status === 1) {
      return res.status(200).json({
        status: true,
        message: p_message || "Campaign invites inserted successfully",
        source: "db",
      });
    } else if (p_status === 0) {
      return res.status(400).json({
        status: false,
        message: p_message || "Failed to insert campaign invites",
        source: "db",
      });
    }
    // Case 3: p_status = -1 → SP failed
    else if (p_status === -1) {
      console.error("Stored Procedure Failure:", p_message);
      return res.status(500).json({
        status: false,
        message: "Something went wrong. Please try again later.",
      });
    }
    else {
      return res.status(500).json({
        status: false,
        message: p_message || "Unexpected database response",
      });
    }
  } catch (error) {
    console.error("error in insertCampaignInvites:",error);
    return res.status(500).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
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
    console.error("Error in browseInviteInfluencer:", error);
    return res.status(500).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};
