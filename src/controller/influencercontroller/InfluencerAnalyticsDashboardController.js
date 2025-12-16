import { client } from "../../config/Db.js";

//1. getInfluencerAnalyticsSummary()

// Fetch top summary cards on dashboard.
// Data Returned: 1 row with totals:
// total_earnings → sum of all completed campaign earnings.
// completed_campaigns → number of campaigns completed.
// proposal_sent → number of proposals sent.
// total_followers → aggregated followers across all platforms.
// total_content → total number of posts/content pieces.
// avg_engagement_rate → average engagement across all content

// 2. getInfluencerEarningSummary()

//Purpose: Provide detailed earning analytics (charts & trends).
//Data Returned: Multiple rows, usually for charting or breakdown:
//month → month name or number
//campaign_id → campaign identifier
//earnings → amount earned
//year → year
//total_campaigns → count of campaigns for that period

//3. getInfluencerSocialStats()

//Data Returned: Rows per platform:
//platform → Instagram, YouTube, TikTok, Facebook
//followers → followers on platform
//posts → total posts
//avg_engagement_rate → engagement on platform

//4. getInfluencerContentTypeStats()

//Data Returned: Rows per content type:
//type → story, reel, video, short
//count → total posts of that type
//views, likes, comments, shares → aggregated per type

//5. getInfluencerContentInsight()

//Data Returned: Rows for each content piece:
//content_id, type, platform, views, likes, comments, shares, posted_date
//Can be filtered or sorted by type, engagement, or date

//6. getInfluencerCampaignContribution()

//Data Returned: Rows per campaign:
//campaign_id, campaign_name, views, likes, comments

//7. getInfluencerImpressionInsight()

//Data Returned: Rows per platform:
//platform, impressions

//8. getInfluencerRecentContent()

//Data Returned: Rows per content piece:
//content_id, media_url, posted_date

//9. getInfluencerAudienceDemographic()

//Data Returned: JSON with structured demographic info:
//gender → male, female, unknown
//age → 13-17, 18-24, 25-34, 35-44, 45+
//platform → followers per platform by gender

export const getInfluencerAnalyticsSummary = async (req, res) => {
 try {
      const p_userid = req.user?.id || req.query.p_userid;

      if (!p_userid)
          return res
            .status(400)
            .json({ Message: "p_userid is required." });
    const result = await client.query(
      `select * from ins.fn_get_influenceranalytic($1::bigint);`,
      [p_userid]
    );
    const influencerAnalyticsSummary = result.rows[0].fn_get_influenceranalytic;
    return res.status(200).json({
      message: "Influencer Analytics summary retrieved successfully",
      data: influencerAnalyticsSummary,
    });
  } catch (error) {
    console.error("error in InfluencerAnalyticsSummary:", error);
    return res.status(500).json({
      message: error.message,
    });
  }
};

export const getInfluencerEarningSummary = async (req, res) => {
  const p_userid = req.user?.id;

  if (!p_userid) {
    return res.status(400).json({
      status: false,
      message: "Influencer Id Required For Earnings Summary",
    });
  }

  try {
    const result = await client.query(
      `SELECT * FROM ins.getInfluencerEarningSummary($1::BIGINT);`,
      [p_userid]
    );

    const InfluencerEarningsSummary = result.rows;

    return res.status(200).json({
      status: true,
      message: "Earning Summary Retrieved Successfully",
      data: InfluencerEarningsSummary,
    });
  } catch (error) {
    console.error("Error In InfluencerEarningSummary:", error);

    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

export const getInfluencerSocialStats = async (req, res) => {
  const p_userid = req.user?.id;

  if (!p_userid)
    return res
      .status(400)
      .json({ Message: "Influencer Id Required For Get Socials Stats" });

  try {
    const result = await client.query(
      `Select * From ins.influencersocialstats($1::BIGINT)`,
      [p_userid]
    );
    const socialstats = result.rows;

    return res.status(200).json({
      Message: "Sucessfully Get Social Stats",
      Data: socialstats,
    });
  } catch (error) {
    console.error("Error In InfluencerEarningSummary:", error);

    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

export const getInfluencerContentTypeStats = async (req, res) => {
  const p_userid = req.user?.id;

  if (!p_userid) {
    return res.status(400).json({
      status: false,
      message: "Influencer Id Required For Content Type Stats",
    });
  }

  try {
    const result = await client.query(
      `SELECT * FROM ins.getInfluencerContentTypeStats($1::BIGINT);`,
      [p_userid]
    );

    const contentTypeStats = result.rows;

    return res.status(200).json({
      status: true,
      message: "Content Type Stats Retrieved Successfully",
      data: contentTypeStats,
    });
  } catch (error) {
    console.error("Error in getInfluencerContentTypeStats:", error);
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

export const getInfluencerContentInsight = async (req, res) => {
  const p_userid = req.user?.id;

  if (!p_userid) {
    return res.status(400).json({
      status: false,
      message: "Influencer Id Required For Content Insight",
    });
  }

  try {
    const result = await client.query(
      `SELECT * FROM ins.getInfluencerContentInsight($1::BIGINT);`,
      [p_userid]
    );

    return res.status(200).json({
      status: true,
      message: "Content Insight Retrieved Successfully",
      data: result.rows,
    });
  } catch (error) {
    console.error("Error in getInfluencerContentInsight:", error);
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

export const getInfluencerCampaignContribution = async (req, res) => {
  const p_userid = req.user?.id;
  if (!p_userid)
    return res.status(400).json({ message: "Influencer Id Required" });

  try {
    const result = await client.query(
      `SELECT * FROM ins.getInfluencerCampaignContribution($1::BIGINT)`,
      [p_userid]
    );
    return res
      .status(200)
      .json({
        status: true,
        message: "Campaign Contribution fetched",
        data: result.rows,
      });
  } catch (error) {
    console.error("Error in getInfluencerCampaignContribution:", error);
    return res
      .status(500)
      .json({
        status: false,
        message: "Internal Server Error",
        error: error.message,
      });
  }
};

export const getInfluencerImpressionInsight = async (req, res) => {
  const p_userid = req.user?.id;
  if (!p_userid)
    return res.status(400).json({ message: "Influencer Id Required" });

  try {
    const result = await client.query(
      `SELECT * FROM ins.getInfluencerImpressionInsight($1::BIGINT)`,
      [p_userid]
    );
    return res
      .status(200)
      .json({
        status: true,
        message: "Impression Insight fetched",
        data: result.rows,
      });
  } catch (error) {
    console.error("Error in getInfluencerImpressionInsight:", error);
    return res
      .status(500)
      .json({
        status: false,
        message: "Internal Server Error",
        error: error.message,
      });
  }
};

export const getInfluencerRecentContent = async (req, res) => {
  const p_userid = req.user?.id;
  if (!p_userid)
    return res.status(400).json({ message: "Influencer Id Required" });

  try {
    const result = await client.query(
      `SELECT * FROM ins.getInfluencerRecentContent($1::BIGINT, $2::INT)`,
      [p_userid, 10]
    );
    return res
      .status(200)
      .json({
        status: true,
        message: "Recent Content fetched",
        data: result.rows,
      });
  } catch (error) {
    console.error("Error in getInfluencerRecentContent:", error);
    return res
      .status(500)
      .json({
        status: false,
        message: "Internal Server Error",
        error: error.message,
      });
  }
};

export const getInfluencerAudienceDemographic = async (req, res) => {
  const p_userid = req.user?.id;
  if (!p_userid)
    return res.status(400).json({ message: "Influencer Id Required" });

  try {
    const result = await client.query(
      `SELECT ins.getInfluencerAudienceDemographic($1::BIGINT) as audience`,
      [p_userid]
    );
    return res
      .status(200)
      .json({
        status: true,
        message: "Audience Demographic fetched",
        data: result.rows[0].audience,
      });
  } catch (error) {
    console.error("Error in getInfluencerAudienceDemographic:", error);
    return res
      .status(500)
      .json({
        status: false,
        message: "Internal Server Error",
        error: error.message,
      });
  }
};

export const getInfluencerTopPerformingContent = async (req, res) => {
  try {
    const p_userid = req.user?.id || req.query.p_userid;

    if (!p_userid) {
      return res.status(400).json({ Message: "p_userid is Required." });
    }

    const { p_filtertype } = req.query;

    if (!p_filtertype) {
      return res.status(400).json({ Message: "p_filtertype is Required." });
    }

    const topPerformingContent = await client.query(
      `select * from ins.fn_get_influencertopperformingcontent($1::bigint,$2::character)`,
      [p_userid, p_filtertype]
    );
    console.log("-->", p_userid, p_filtertype);

    const topPerContentRes = topPerformingContent.rows[0];

    return res.status(200).json({
      Message: "Top Performing Content Successfully Get",
      result: topPerContentRes,
    });
  } catch (error) {
    console.error("error in Get Influencer Top Performing Content:", error);
    return res.status(500).json({
      message: error.message,
    });
  }
};

export const getInfluencerPerformanceOvertime = async (req, res) => {
  try {
    const p_userid = req.user?.id || req.query.p_userid;

    if (!p_userid) {
      return res.status(400).json({ Message: "p_userid Required" });
    }

    const { p_filtertype } = req.query;
    const performanceOverTime = await client.query(
      ` select * from ins.fn_get_influencerperformanceovertime($1::bigint,$2::character)`,
      [p_userid, p_filtertype]
    );
    console.log(p_userid, p_filtertype);

    const performanceOvertimeRes = performanceOverTime.rows[0];

    console.log("OverTimeData", performanceOverTime);

    return res.status(200).json({
      Message: "Influencer Performance Over Time Successfully Get",
      result: performanceOvertimeRes,
    });
  } catch (error) {
    console.error("error in Get Influencer Performance OverTime:", error);
    return res.status(500).json({
      message: error.message,
    });
  }
};

export const getInfluencerAnalyticsPlatformBreakdown = async (req, res) => {
  try {
    const p_userid = req.user?.id || req.query.p_userid;

    if (!p_userid)
      return res.status(400).json({ Message: "p_userid is required." });

    const { p_year, p_month } = req.query;
    if (!p_year)
      return res.status(400).json({ Message: "p_year is required." });

    const plateFormBreakdown = await client.query(
      `select * from ins.fn_get_influencerplatformbreakdown(
            $1::bigint,
            $2::integer,
            $3::integer 
            )`,
      [p_userid, p_year, p_month || null]
    );

    const breakDownRes =plateFormBreakdown.rows[0].fn_get_influencerplatformbreakdown;

    return res.status(200).json({
      Message: "InfluencerAnalyticsPlateForm Fetched Sucessfully",
      result: breakDownRes,
    });
  } catch (error) {
    console.error("error in getInfluencerAnalyticsPlatformBreakdown:", error);
    return res.status(500).json({
      message: error.message,
    });
  }
};