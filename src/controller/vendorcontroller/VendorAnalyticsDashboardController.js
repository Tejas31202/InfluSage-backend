import { client } from "../../config/Db.js";

export const getVendorAnalyticsSummary = async (req, res) => {
  try {
    const p_userid = req.user?.id || req.query.p_userid;
    const result = await client.query(
      "select * from ins.getVendorAnalyticsSummary($1::bigint);",
      [p_userid]
    );
    //this function return conunts:-totalcampaign,totalimpression,engagementrate,totalcontentpieces,avg engegment per influe
    const data = result.rows[0];
    return res.status(200).json({
      message: "Analytics summary retrieved successfully",
      data: data,
    });
  } catch (error) {
    console.error("error in getVendorAnalyticsSummary:", error);
    return res.status(500).json({
      message: error.message,
    });
  }
};

export const getVendorCampaignOverview = async (req, res) => {
  try {
    const p_userid = req.user?.id || req.query.p_userid;
    const result = await client.query(
      "select * from ins.getVendorCampaignOverview($1::bigint);",
      [p_userid]
    );
    //this function return campaignname,platforms,views,engagement,status 
    const data = result.rows[0];
    return res.status(200).json({
      message: "Campaign overview retrieved successfully.",
      data: data,
    });
  } catch (error) {
    console.error("error in getVendorCampaignOverview:", error);
    return res.status(500).json({
      message: error.message,
    });
  }
};


export const getPerformanceTimeline = async (req, res) => {
  try {
    const p_userid = req.user?.id || req.query.p_userid;
    const labalid=req.query.labalid;
    const result = await client.query(
      "select * from ins.getPerformanceTimeline($1::bigint,$2::smallint);",
      [p_userid,labalid]
    );
    //this function return views,likes,comments,count base on filter like weekly/monthly/yearly
    const data = result.rows[0];
    return res.status(200).json({
      message: "Performance data over time retrieved successfully.",
      data: data,
    });
  } catch (error) {
    console.error("error in getPerformanceTimeline:", error);
    return res.status(500).json({
      message: error.message,
    });
  }
};

export const getTopPerformingContent = async (req, res) => {
  try {
    const p_userid = req.user?.id || req.query.p_userid;
    const result = await client.query(
      "select * from ins.getTopPerformingContent($1::bigint);",
      [p_userid]
    );
    //this function return content-title,view-conunt,engagement
    const data = result.rows[0];
    return res.status(200).json({
      message: "Top-performing content fetched successfully.",
      data: data,
    });
  } catch (error) {
    console.error("error in getTopPerformingContent:", error);
    return res.status(500).json({
      message: error.message,
    });
  }
};

export const getGraphFiltersDropdown=async (req, res) => {
  try {
    const result = await client.query(
      "select * from ins.getGraphFiltersDropdown();");
    //this function return filter list:-monthly,weekly,yearly
    const data = result.rows[0];
    return res.status(200).json({
      message: "Graph filter dropdown data fetched successfully.",
      data: data,
    });
  } catch (error) {
    console.error("error in getGraphFiltersDropdown:", error);
    return res.status(500).json({
      message: error.message,
    });
  }
};


export const getPlatformBreakdown = async (req, res) => {
  try {
    const p_userid = req.user?.id || req.query.p_userid;
    const result = await client.query(
      "select * from ins.getPlatformBreakdown($1::bigint);",
      [p_userid]
    );
    //this function return :- platform and view count
    const data = result.rows[0];
    return res.status(200).json({
      message: "Platform breakdown data fetched successfully.",
      data: data,
    });
  } catch (error) {
    console.error("error in getPlatformBreakdown:", error);
    return res.status(500).json({
      message: error.message,
    });
  }
};

export const getVendorRecentContents= async (req, res) => {
  try {
    const p_userid = req.user?.id || req.query.p_userid;
    const result = await client.query(
      "select * from ins.getVendorRecentContents($1::bigint);",
      [p_userid]
    );
    //this function return content item posted by influe :-1>thubnail,2>postDate,3>views/likes/comments 
    const data = result.rows[0];
    return res.status(200).json({
      message: "Recent contents fetched successfully.",
      data: data,
    });
  } catch (error) {
    console.error("error in getVendorRecentContents:", error);
    return res.status(500).json({
      message: error.message,
    });
  }
};