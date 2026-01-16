import { client } from "../../config/Db.js";
import { HTTP } from "../../utils/Constants.js";

export const getVendorAnalyticsSummary = async (req, res) => {
  try {
    const p_userid = req.user?.id || req.query.p_userid;
    const result = await client.query(
      "SELECT * FROM ins.fn_get_vendoranalytic($1::bigint);",
      [p_userid]
    );

    const data = result.rows[0].fn_get_vendoranalytic;
    return res.status(HTTP.OK).json({
      message: "Analytics summary retrieved successfully",
      data: data,
    });
  } catch (error) {
    console.error("error in getVendorAnalyticsSummary:", error);
    return res.status(HTTP.INTERNAL_ERROR).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};

export const getVendorCampaignOverview = async (req, res) => {
  try {
    const p_userid = req.user?.id || req.query.p_userid;
    const p_filtertype = req.query.p_filtertype;

    if (!p_filtertype) {
      res.status(HTTP.BAD_REQUEST).json({ message: "p_filtertype is required" })
    }
    // Allow only week / month / year
    const allowedFilters = ["week", "month", "year"];
    if (!p_filtertype || !allowedFilters.includes(p_filtertype)) {
      return res.status(HTTP.BAD_REQUEST).json({
        message: "Invalid p_filtertype. Allowed values: week, month, year"
      });
    }

    const result = await client.query(
      "select * from ins.fn_get_vendorcampaignoverview($1::bigint,$2::varchar(15));",
      [p_userid, p_filtertype]
    );

    const data = result.rows[0].fn_get_vendorcampaignoverview;
    return res.status(HTTP.OK).json({
      message: "Campaign overview retrieved successfully.",
      data: data,
    });
  } catch (error) {
    console.error("error in getVendorCampaignOverview:", error);
    return res.status(HTTP.INTERNAL_ERROR).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};

export const getPerformanceTimeline = async (req, res) => {
  try {
    const p_userid = req.user?.id || req.query.p_userid;

    const p_filtertype = req.query.p_filtertype;

    if (!p_filtertype) {
      res.status(HTTP.BAD_REQUEST).json({ message: "p_filtertype is required" })
    }
    // Allow only week / month / year
    const allowedFilters = ["week", "month", "year"];
    if (!p_filtertype || !allowedFilters.includes(p_filtertype)) {
      return res.status(HTTP.BAD_REQUEST).json({
        message: "Invalid p_filtertype. Allowed values: week, month, year"
      });
    }

    const result = await client.query(
      "SELECT ins.fn_get_vendorperformanceovertime($1::bigint,$2::varchar(55));",
      [p_userid, p_filtertype]
    );

    const data = result.rows[0].fn_get_vendorperformanceovertime;

    return res.status(HTTP.OK).json({
      message: "Performance data over time retrieved successfully.",
      data: data,
    });
  } catch (error) {
    console.error("error in getPerformanceTimeline:", error);
    return res.status(HTTP.INTERNAL_ERROR).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};

export const getTopPerformingContent = async (req, res) => {
  try {
    const p_userid = req.user?.id || req.query.p_userid;
    const p_filtertype = req.query.p_filtertype;

    if (!p_filtertype) {
      res.status(HTTP.BAD_REQUEST).json({ message: "p_filtertype is required" })
    }
    // Allow only week / month / year
    const allowedFilters = ["week", "month", "year"];
    if (!p_filtertype || !allowedFilters.includes(p_filtertype)) {
      return res.status(HTTP.BAD_REQUEST).json({
        message: "Invalid p_filtertype. Allowed values: week, month, year"
      });
    }
    const result = await client.query(
      "select * from ins.fn_get_vendortopperformingcontent($1::bigint,$2::varchar(15));",
      [p_userid, p_filtertype]
    );

    const data = result.rows[0].fn_get_vendortopperformingcontent;

    return res.status(HTTP.OK).json({
      message: "Top-performing content fetched successfully.",
      data: data,
    });
  } catch (error) {
    console.error("error in getTopPerformingContent:", error);
    return res.status(HTTP.INTERNAL_ERROR).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};

export const getPlatformBreakdown = async (req, res) => {
  try {
    const p_userid = req.user?.id || req.query.p_userid;
    const { p_year, p_month } = req.query;
    if (!p_year) {
      res.status(HTTP.BAD_REQUEST).json({ message: "p_year is required" })
    }
    const result = await client.query(
      " SELECT  * from ins.fn_get_vendorplatformbreakdown($1::bigint,$2::integer,$3::integer);",
      [
        p_userid,
        p_year,
        p_month || null
      ]
    );
    const data = result.rows[0].fn_get_vendorplatformbreakdown;
    return res.status(HTTP.OK).json({
      message: "Platform breakdown data fetched successfully.",
      data: data,
    });
  } catch (error) {
    console.error("error in getPlatformBreakdown:", error);
    return res.status(HTTP.INTERNAL_ERROR).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};

export const getVendorCampaignList = async (req, res) => {
  const p_userid = req.user?.id || req.query.p_userid;
  if (!p_userid) return res.status(HTTP.BAD_REQUEST).json({ Message: "User Id Required For Get Campaign List" });
  try {
    const campaignList = await client.query(`
      select * from ins.fn_get_vendorcampaignlist($1::bigint)`,
      [p_userid]
    );
    const campaignListRes = campaignList.rows[0].fn_get_vendorcampaignlist || [];
    return res.status(HTTP.OK).json({
      Message: "campaign List Get Successfully",
      data: campaignListRes,
      sorce: "db"
    })
  } catch (error) {
    console.error("error in get Campaign List:", error);
    return res.status(HTTP.INTERNAL_ERROR).json({
      message: error.message,
    });
  }
}

export const getVendorCampaignInsight = async (req, res) => {
  const p_userid = req.user?.id || req.query.p_userid;
  const p_campaignid = req.query.p_campaignid;
  if (!p_userid || !p_campaignid) return res.status(HTTP.BAD_REQUEST).json({ Message: "User Id And Campaign Id Required For Campaign insight Details" });
  try {
    const campaignInsight = await client.query(`
      select * from ins.fn_get_vendorcampaigninsight($1::bigint,$2::bigint)`,
      [
        p_userid,
        p_campaignid
      ]
    );
    const campaignInsightRes = campaignInsight.rows[0].fn_get_vendorcampaigninsight || [];
   
    return res.status(HTTP.OK).json({
      Message: "Campaign Insight Details Get Successfully",
      data: campaignInsightRes,
      source: "db"
    });
  } catch (error) {
    console.error("error in get Campaign Insight Details:", error);
    return res.status(HTTP.INTERNAL_ERROR).json({
      message: error.message,
    });
  }
}

export const getVendorCampaignPerformanceOvertime = async (req, res) => {
  const p_userid = req.user?.id || req.query.p_userid;
  const p_campaignid = req.query.p_campaignid;
  if (!p_userid || !p_campaignid) return res.status(HTTP.BAD_REQUEST).json({ Message: "User id And Campaign id Required For get Campaign Performance Overtime" });
  const { p_filtertype } = req.query;
  try {
    const performanceOverTime = await client.query(`
    select * from ins.fn_get_vendorcampaignperformanceovertime($1::bigint,$2::bigint,$3::VARCHAR)`,
      [
        p_userid,
        p_campaignid,
        p_filtertype || 'year'
      ]);
    const performanceOvertimeRes = performanceOverTime.rows[0].fn_get_vendorcampaignperformanceovertime || [];
    return res.status(HTTP.OK).json({
      message: "Campaign Performance Sucessfully Get",
      data: performanceOvertimeRes,
      source: "db"
    })
  } catch (error) {
    console.error("error in get Campaign Performance Overtime:", error);
    return res.status(HTTP.INTERNAL_ERROR).json({
      message: error.message,
    });

  }
}

export const getVendorCampaignTopPerformingContent = async (req, res) => {
  const p_userid = req.user?.id || req.query.p_userid;
  const p_campaignid = req.query.p_campaignid;
  if (!p_userid || !p_campaignid) return res.status(HTTP.BAD_REQUEST).json({ Message: "user Id and Campaign Id Required For Top Performing Contents" });
  const { p_filtertype } = req.query;
  try {
    const topPerformingContent = await client.query(`
      select * from ins.fn_get_vendorcampaigntopperformingcontent($1::bigint,$2::bigint,$3::varchar)`,
      [
        p_userid,
        p_campaignid,
        p_filtertype || 'year'
      ]
    );
    const topperformingcontentRes = topPerformingContent.rows[0].fn_get_vendorcampaigntopperformingcontent || [];
    
    return res.status(HTTP.OK).json({
      Message: "Top Performing Content Get Sucessfully",
      data: topperformingcontentRes,
      p_filtertype:p_filtertype,
      source: "db"
    })
  } catch (error) {

    console.error("error in get Campaign Top Performing Content:", error);
    return res.status(HTTP.INTERNAL_ERROR).json({
      message: error.message,
    });

  }
}

export const getVendorCampaignEngagementScore = async (req, res) => {
  const p_userid = req.user?.id || req.query.p_userid;
  const p_campaignid = req.query.p_campaignid;
  if (!p_userid || !p_campaignid) return res.status(HTTP.BAD_REQUEST).json({ Message: "User Id and Campaign Id required For Get Vendor Campaign Engagement Score" });
  const { p_filtertype } = req.query;
  try {
    const campaignEngagementScore = await client.query(`
      select * from ins.fn_get_vendorcampaignengagementscore($1::bigint,$2::bigint,$3::VARCHAR)`,
      [
        p_userid,
        p_campaignid,
        p_filtertype || 'year'
      ]
    );
    const campaignEngagementScoreRes = campaignEngagementScore.rows[0].fn_get_vendorcampaignengagementscore[0] || [];
    return res.status(HTTP.OK).json({
      Message: "campaign Engagement Score Sucessfully Get",
      data: campaignEngagementScoreRes,
      source: "db"
    })
  } catch (error) {
    console.error("error in get Campaign Engagement Score:", error);
    return res.status(HTTP.INTERNAL_ERROR).json({
      message: error.message,
    });
  }
}
