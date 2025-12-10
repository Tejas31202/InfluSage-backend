import { client } from '../../config/Db.js';

export const getAdminAnalyticsNewContents = async (req, res) => {
  try {
    const p_adminid = req.user?.id || req.query.p_adminid;

    if (!p_adminid) {
      return res.status(400).json({
        message: "p_adminid is required.",
      });
    }
    const {
      p_providers,
      p_contenttype,
      p_sortorder,
      p_pagenumber,
      p_pagesize,
      p_search,
    } = req.query;

    const result = await client.query(
      `select * from ins.fn_get_contractcontentlinklist(
        $1::bigint,
        $2::json,
        $3::json,
        $4::text,
        $5::integer,
        $6::integer,
        $7::text
      );`,
      [
        p_adminid,
        p_providers || null,
        p_contenttype || null,
        p_sortorder || "DESC",
        p_pagenumber || 1,
        p_pagesize || 20,
        p_search || null,
      ]
    );

    const data = result.rows[0].fn_get_contractcontentlinklist;

    return res.status(200).json({
      message: "New contents retrieved successfully",
      data: data,
    });
  } catch (error) {
    console.error("Error in getAdminAnalyticsNewContents:", error);
    return res.status(500).json({
      message: error.message,
    });
  }
};

export const getUpdatedAnalyticsContents = async (req, res) => {
  try {
    const p_adminid = req.user?.id || req.query.p_adminid;

    const {
      p_providers,
      p_sortby,
      p_sortorder,
      p_pagenumber,
      p_pagesize,
      p_search
    } = req.query;

    const result = await client.query(
      `SELECT * FROM ins.getUpdatedAnalyticsContents(
        $1::bigint,
        $2::json,
        $3::text,
        $4::text,
        $5::integer,
        $6::integer,
        $7::text
      );`,
      [
        p_adminid,
        p_providers || null,
        p_sortby || "createddate",
        p_sortorder || "DESC",
        p_pagenumber || 1,
        p_pagesize || 20,
        p_search || null
      ]
    );

    // This function returns:
    // influencer_image, influencer_name, campaign_name,
    // platforms, content_links, updated_date is admin update analytic date
    const data = result.rows[0];

    return res.status(200).json({
      message: "Updated contents retrieved successfully",
      data
    });
  } catch (error) {
    console.error("Error in getUpdatedAnalyticsContents:", error);
    return res.status(500).json({
      message: error.message
    });
  }
};

export const getAllContentHistories = async (req, res) => {
  try {
    const p_adminid = req.user?.id || req.query.p_adminid;
    const result = await client.query(
      "select * from ins.getAllContentHistories($1::bigint);",
      [p_adminid]
    );
    // This function returns:
    // influencer_image, influencer_name, campaign_name,
    // platforms, content_links,first_updated and lastupdated_date 
    const data = result.rows[0];
    return res.status(200).json({
      message: "All content history retrieved successfully.",
      data: data,
    });
  } catch (error) {
    console.error("error in getAllContentHistories:", error);
    return res.status(500).json({
      message: error.message,
    });
  }
};

export const getInfluencerContentHistory = async (req, res) => {
  try {
    const p_adminid = req.user?.id || req.query.p_adminid;
    const p_influencerid = req.params.p_influencerid;

    const result = await client.query(
      "SELECT * FROM ins.getInfluencerContentHistory($1::bigint,$2::bigint);",
      [p_adminid, p_influencerid]
    );

    // This function returns analytics update history:
    // comments, likes, views (admin-updated analytics data)
    const data = result.rows[0];

    return res.status(200).json({
      message: "Content history retrieved successfully.",
      data
    });
  } catch (error) {
    console.error("Error in getInfluencerContentHistory:", error);
    return res.status(500).json({
      message: error.message
    });
  }
};

export const insertAnalyticsRecord = async (req, res) => {
  console.log("insert Analytics called")
  try {
    const p_adminid = req.user?.id || req.query.p_adminid;
    const {
      p_campaignid,
      p_influencerid,
      p_contentlinkid,
      p_metricsjson
    } = req.body || {};

    console.log("Data==>",req.body)

    if (!p_campaignid || !p_influencerid || !p_contentlinkid || !p_metricsjson) {
      return res.status(400).json({
        message: "Required fields: p_campaignid, p_influencerid, p_contentlinkid, p_metricsjson"
      });
    }

    const result = await client.query(
      `CALL ins.usp_insert_userplatformanalytic(
        $1::bigint,
        $2::bigint,
        $3::bigint,
        $4::bigint,
        $5::json,
        $6::smallint,
        $7::text
      );`,
      [
        p_adminid,
        p_campaignid,
        p_influencerid,
        p_contentlinkid,
        JSON.stringify(p_metricsjson),
        null,
        null
      ]
    );

    console.log("result",result)

    const { p_status, p_message } = result.rows[0];


    // console.log("p stauts==>", p_status)

    if (p_status === 1) {
      return res.status(200).json({
        message: p_message,
        p_status,
      });
    }
    else if (p_status === 0) {
      return res.status(400).json({
        message: p_message || "Validation failed",
        p_status,
      });
    }
    else if (p_status === -1) {
      return res.status(500).json({
        message: "Something went wrong. Please try again later.",
        p_status: false,
      });
    }
    else {
      return res.status(500).json({
        message: "Unexpected database response",
        p_status: false,
      });
    }
  } catch (error) {
    console.error("Error in insert AnalyticsRecord:", error);
    return res.status(500).json({
      message: error.message,
    });
  }
};

export const getUserPlatformAnalytics = async (req, res) => {

  const p_adminid = req.user?.id;
  const p_userplatformanalyticid = req.query.p_userplatformanalyticid;

  if (!p_adminid) return res.status(400).json({ Message: "Admin ID Required." })

  if (!p_userplatformanalyticid) return res.status(400).json({ Message: "p_userplatformanalyticid Required." })


  try {
    const result = await client.query(`SELECT * FROM ins.fn_get_userplatformanalytic($1::BIGINT,$2::BIGINT)`,
      [p_adminid, p_userplatformanalyticid]
    )

    const userPlatformAnalytics = result.rows[0].fn_get_userplatformanalytic[0];

    if (!userPlatformAnalytics.length) {
      return res.status(200).json({
        Message: "No analytics found.",
        data: userPlatformAnalytics
      });
    }

    // console.log("Analytics", userPlatformAnalytics);

    return res.status(200).json({
      Message: "Successfully fetched userPlatformAnalytics",
      data: userPlatformAnalytics,
      source: "db"
    })

  } catch (error) {
    console.error("user plateformAnalytics fetching error ", error)
    return res.status(500).json({ Message: "Internal Server Error" });

  }
};

export const getAnalyticList = async (req, res) => {
  const p_adminid = req.user?.id;

  if (!p_adminid) return res.status(400).json({ Message: "Admin Id Required." });

  const { p_providers, p_contenttype, p_sortorder, p_pagenumber, p_pagesize, p_search } = req.query;

  try {

    const analyticsList = await client.query(`select * from ins.fn_get_analyticlist(
    $1::bigint,
    $2::json,
    $3::json,
    $4::text,
    $5::int,
    $6::int,
    $7::text
    )`,
      [
        p_adminid,
        p_providers || null,
        p_contenttype || null,
        p_sortorder || "DESC",
        p_pagenumber || 1,
        p_pagesize || 20,
        p_search || null,
      ]);

    const result = analyticsList.rows;

    // console.log("AnalyticsList==>", result[0].fn_get_analyticlist)

    if (!result.length) return res.status(404).json({ message: "Analytic List Not Available." })

    return res.status(200).json({
      message: "Successfully fetched analytics list",
      data: result[0].fn_get_analyticlist,
      source: "db"
    })

  } catch (error) {
    console.log("Error Getting AnalyticsList", error)
    return res.status(500).json({ Message: "Internal Server Error" });
  }
};