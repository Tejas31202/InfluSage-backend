import { client } from '../../config/Db.js';
import Redis from '../../utils/redisWrapper.js';

// const Redis = redis.createClient({ url: process.env.REDIS_URL });
// Redis.connect().catch(console.error);

export const getOffersForCampaign = async (req, res) => {
  try {
    const userId = req.user?.id || req.body.userId;
    const { sortby, sortorder, pagenumber, pagesize, p_search } = req.query;

    const result = await client.query(
      `SELECT * from ins.fn_get_campaignoffer(
      $1:: bigint,
      $2:: text,
      $3:: text,
      $4:: integer,
      $5:: integer,
      $6:: text 
      )`,
      [
        userId,
        sortby || "startdate",
        sortorder || "DESC",
        pagenumber || 1,
        pagesize || 20,
        p_search || null,
      ]
    );

    //Check Db Return Data OR Not
    if (!result.rows) {
      return res.status(404).json({ message: "campaign offer not found." });
    }

    const offers = result.rows[0].fn_get_campaignoffer;
    //Return Data From Db
    return res.status(200).json({
      data: offers,
      source: "db",
    });
  } catch (error) {
    console.error("Error fetching campaigns offers:", error.message);
    return res.status(500).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};

export const getViewAllOffersForSingleCampaign = async (req, res) => {
  // const userId = req.user?.id || req.body.userId;
  const campaignId = req.params.campaignId;
  const { pagenumber, pagesize, p_search } = req.query;
  try {
    const result = await client.query(
      `select * from ins.fn_get_appliedcampaignapplications(
       $1:: BIGINT,
        $2:: integer,
        $3:: integer,
        $4:: text
        )`,
      [campaignId, pagenumber || 1, pagesize || 20, p_search || null]
    );

    //Check Db Return Data OR Not
    if (!result.rows) {
      return res.status(404).json({ message: "campaign offer not found." });
    }

    const offers = result.rows[0].fn_get_appliedcampaignapplications;
    //Return Data From Db
    return res.status(200).json({
      data: offers,
      source: "db",
    });
  } catch (error) {
    console.error("Error fetching view campaigns offers:", error.message);
    return res.status(500).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};

export const updateApplicationStatus = async (req, res) => {
  const userId = req.user?.id || req.body.userId;

  if (!userId) {
    return res.status(401).json({
      status: false,
      message: "Unauthorized: user not found",
    });
  }
  const { p_applicationid, p_statusname } = req.body || {};

  if (!p_applicationid || !p_statusname) {
    return res
      .status(400)
      .json({ error: "Required fields: p_applicationid and p_statusname." });
  }

  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT set_config('app.current_user_id', $1, true)",
      [String(userId)]
    );
    const result = await client.query(
      `CALL ins.usp_update_applicationstatus(
        $1::bigint,
        $2::varchar,
        $3::smallint,
        $4::text
        )`,
      [p_applicationid, p_statusname, null, null]
    );
    await client.query("COMMIT");
    const row = result.rows?.[0] || {};
    const p_status = Number(row.p_status);
    const p_message = row.p_message;

    // ----------------- HANDLE p_status -----------------
    if (p_status === 1) {
      return res.status(200).json({
        status: true,
        message: p_message || "Application status updated successfully",
        source: "db",
      });
    } else if (p_status === 0) {
      return res.status(400).json({
        status: false,
        message: p_message || "Validation failed",
        source: "db",
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
    console.error("Error in update application status :", error.message);
    return res.status(500).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};

export const getOfferDetails = async (req, res) => {
  const applicationId = req.params.applicationId;
  const userId = req.user?.id || req.body.userId;
  try {
    const result = await client.query(
      `select * from ins.fn_get_offerdetails($1::bigint, $2::bigint);`,
      [userId, applicationId]
    );

    if (!result.rows) {
      return res.status(404).json({ message: "offer detail not found." });
    }

    const offer = result.rows[0].fn_get_offerdetails[0];

    if (!offer) {
      return res.status(404).json({ message: "offer detail not found." });
    }

    return res.status(200).json({
      data: offer,
      source: "db",
    }); 
  } catch (error) {
    console.error("Error in get offer detail :", error.message);
    return res.status(500).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};

export const getCampaignDetail = async (req, res) => {
  const userId = req.user?.id || req.body.userId;
 
  const campaignId = req.params.campaignId;
  try {
    const result = await client.query(
      `SELECT * FROM ins.fn_get_campaigndetailsjson(
        $1:: bigint,
        $2:: bigint
      )`,
      [userId, campaignId]
    );

    //Check Db Return Data OR Not
    if (!result.rows) {
      return res.status(404).json({ message: "campaign offer not found." });
    }

    const campaign = result.rows[0];

    //Return Data From Db
    return res.status(200).json({
      data: campaign,
      source: "db",
    });
  } catch (error) {
    console.error("Error get campaign detail error:", error.message);
    return res.status(500).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};
