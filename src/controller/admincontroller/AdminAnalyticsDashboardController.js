import { client } from '../../config/Db.js';

export const getAdminAnalyticsNewContents = async (req, res) => {
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
      `SELECT * FROM ins.getAdminAnalyticsNewContents(
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
        p_providers||null,
        p_sortby || "createddate",
        p_sortorder || "DESC",
        p_pagenumber || 1,
        p_pagesize || 20,
        p_search || null
      ]
    );

    // This function returns:
    // influencer_image, influencer_name, campaign_name,
    // platforms, content_links, created_date
    const data = result.rows[0];

    return res.status(200).json({
      message: "New contents retrieved successfully",
      data
    });
  } catch (error) {
    console.error("Error in getAdminAnalyticsNewContents:", error);
    return res.status(500).json({
      message: error.message 
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
        p_providers||null,
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
    const p_influencerid=req.params.p_influencerid;

    const result = await client.query(
      "SELECT * FROM ins.getInfluencerContentHistory($1::bigint,$2::bigint);",
      [p_adminid,p_influencerid]
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
  try {
    const p_adminid = req.user?.id || req.query.p_adminid;
    const { p_influencerid, views, likes, comments } = req.body;

    const result = await client.query(
      `CALL ins.usp_insert_analyticscount(
        $1::bigint,
        $2::bigint,
        $3::integer,
        $4::integer,
        $5::integer,
        $6::bigint,
        $7::bigint
      );`,
      [
        p_adminid,
        p_influencerid,
        views,
        likes,
        comments,
        null,
        null
      ]
    );

    const { p_status, p_message } = result.rows[0];

    if (p_status) {
      return res.status(200).json({
        message: p_message,
        p_status,
      });
    } else {
      return res.status(400).json({
        message: p_message,
        p_status
      });
    }
  } catch (error) {
    console.error("Error in insertAnalyticsData:", error);
    return res.status(500).json({
      message: error.message,
    });
  }
};