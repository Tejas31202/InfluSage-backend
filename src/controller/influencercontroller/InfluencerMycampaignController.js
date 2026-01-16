import { client } from "../../config/Db.js";
import { HTTP, SP_STATUS } from "../../utils/Constants.js";

export const getClientsList = async (req, res) => {
  const p_userid = req.user?.id || req.body.p_userid;

  try {
    if (!p_userid) {
      return res.status(HTTP.BAD_REQUEST).json({ message: "User Id Require" });
    }

    const result = await client.query(
      `SELECT * FROM ins.fn_get_clients($1::BIGINT)`,
      [p_userid]
    );

    if (!result || result.rows.length === 0) {
      return res.status(HTTP.NOT_FOUND).json({ message: "No Client Found" });
    }

    const clientList = result.rows[0].fn_get_clients;

    return res.status(HTTP.OK).json({
      message: "clientList Fetched Successfully",
      data: clientList,
      source: "db",
    });
  } catch (error) {
    console.error("Error While Fetching clientList", error);
    return res.status(HTTP.INTERNAL_ERROR).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};
//..................Get All Influencer Campaign..................
export const getInfluencerMyContract = async (req, res) => {
  const p_userid = req.user?.id || req.body.p_userid;
  try {
    if (!p_userid) {
      return res.status(HTTP.BAD_REQUEST).json({ message: "User Id Require" });
    }
    const {
      p_statuslabelid,
      p_providers,
      p_clients,
      p_maxbudget,
      p_minbudget,
      p_startdate,
      p_enddate,
      p_sortby,
      p_sortorder,
      p_pagenumber,
      p_pagesize,
      p_search,
    } = req.query;
    const result = await client.query(
      `SELECT * FROM ins.fn_get_influencermycontract(
            $1::bigint,
            $2::smallint,
            $3::json,
            $4::json,
            $5::numeric,
            $6::numeric,
            $7::date,
            $8::date,
            $9::text,
            $10::text,
            $11::integer,
            $12::integer,
            $13::text)`,
      [
        p_userid,
        p_statuslabelid || null,
        p_providers || null,
        p_clients || null,
        p_maxbudget || null,
        p_minbudget || null,
        p_startdate || null,
        p_enddate || null,
        p_sortby || "createddate"||"paymentamount",
        p_sortorder || "DESC",
        p_pagenumber || 1,
        p_pagesize || 20,
        p_search || null
      ]
    );
    const influencerContract = result.rows[0].fn_get_influencermycontract || {};
    return res.status(HTTP.OK).json({
      message: "Influencer campaigns fetched successfully",
      data: influencerContract,
      source: "db",
    });
  } catch (error) {
    console.error("Error Getting Influencer My Campaign", error);
    return res.status(HTTP.INTERNAL_ERROR).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};
//.............Get SingleInfluencer Campaign.........................
export const getInfluencerMyCampaignDetails = async (req, res) => {
  const p_userid = req.user?.id || req.body.p_userid;

  const p_campaignid = req.params.p_campaignid;
  try {
    if (!p_campaignid) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ message: "p_campaignid are Require" });
    }

    const result = await client.query(
      `SELECT * FROM ins.fn_get_influencermycampaigndetails(
        $1::BIGINT,
        $2::BIGINT
        )`,
      [p_userid, p_campaignid]
    );

    if (!result || result.rows.length === 0) {
      return res.status(HTTP.NOT_FOUND).json({ message: "Campaign Not Found" });
    }

    const influencerCampaign =
      result.rows[0].fn_get_influencermycampaigndetails[0];

    return res.status(HTTP.OK).json({
      message: "Campaign Fetched Successfully",
      data: influencerCampaign,
      source: "db",
    });
  } catch (error) {
    console.error("Error in getInfluencerMyCampaignDetails:", error);
    return res.status(HTTP.INTERNAL_ERROR).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};

export const getInfluencerMyCampaignStatus = async (req, res) => {
  try {
    const status = await client.query(
      `SELECT * FROM ins.fn_get_influencermycampaignstatus()`
    )
    const result = status.rows;

    return res.status(HTTP.OK).json(
      {
        Message: "Influencer MyCampaign status Fetched Successfully",
        data: result,
        source: "db"
      }
    )
  } catch (error) {
    console.error("Error in getInfluencerMyCampaignStatus:", error);
    return res.status(HTTP.INTERNAL_ERROR).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
}

export const getInfluencerMyContractStatus = async (req, res) => {
  try {
    const status = await client.query(
      `SELECT * FROM ins.fn_get_influencermycontractstatus();`
    )
    const result = status.rows;

    return res.status(HTTP.OK).json({
        Message: "Influencer My Contract status Fetched Successfully.",
        data: result,
        source: "db"
      })
  } catch (error) {
    console.error("Error in getInfluencerMyContractStatus:", error);
    return res.status(HTTP.INTERNAL_ERROR).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
}


