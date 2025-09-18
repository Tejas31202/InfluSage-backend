import { client } from "../../config/Db.js";
import redis from "redis";

const redisClient = redis.createClient({ url: process.env.REDIS_URL });
redisClient.connect().catch(console.error);

export const getOffersForCampaign = async (req, res) => {
  try {
    const userId = req.user?.id || req.body.userId;
    const { sortby, sortorder, pagenumber, pagesize, p_search } = req.query;

    const result = await client.query(
      `SELECT * from ins.fn_get_campaignoffer(
     $1:: BIGINT,
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
    return res.status(500).json({ msg: error.msg });
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
    return res.status(500).json({ msg: error.msg });
  }
};
