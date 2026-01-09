import { client } from '../../config/Db.js';

export const getVendorCompleteProfilePercentage = async (req, res) => {
  try {
    const p_userid = req.user?.id || req.body.p_userid;
    if (!p_userid) {
      return res.status(400).json({
        message: "User ID is required to fetch profile completion percentage.",
      });
    }
    const result = await client.query(
      "SELECT * FROM ins.fn_complete_vendorprofilepercentage($1::bigint)",
      [p_userid]
    );
    if (result.rowCount === 0 || !result.rows[0]) {
      return res.status(404).json({
        message: "No data found for the given user.",
      });
    }
    const percentage = result.rows[0].fn_complete_vendorprofilepercentage;
    return res.status(200).json({
      message: "Profile completion percentage fetched successfully.",
      percentage: percentage,
      source: "db",
    });
  } catch (error) {
    console.error("Error in getVendorProfileCompletionPercentage:", error);
    return res.status(500).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};

export const getVendorPerformanceSummary = async (req, res) => {
  try {
    const p_userid = req.user?.id;
    if (!p_userid) {
      return res.status(400).json({
        Message: "User ID is required to fetch Vendorperformance Summary",
      });
    }

    const performancesummary = await client.query(
      ` select * from ins.fn_get_vendordashboard($1::bigint)`,
      [p_userid]
    );

    const result = performancesummary.rows?.[0]?.fn_get_vendordashboard;

    return res.status(200).json({
      Message: "Vendor PerformanceSummary SucessFully Fetched",
      Data: result,
      source: "db",
    });
  } catch (error) {
    console.error("Error in getVendorPerformanceSummary:", error);
    return res.status(500).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};

export const getVendorPendingContentList = async (req, res) => {
  const p_userid = req.user?.id || req.query.p_userid;
  if (!p_userid) return res.status(400).json({ Message: "User If Required For Get Pending Content" });
  try {
    const pendingContentList = await client.query(`
      select * from ins.fn_get_vendorpendingcontenttypelist($1::bigint)`,
      [p_userid]);
    const pendingContentListRes = pendingContentList.rows[0].fn_get_vendorpendingcontenttypelist;
    return res.status(200).json({
      Message: "Vendor Pending List Get Sucessfully",
      data: pendingContentListRes,
      source: "db"
    })
  } catch (error) {
    console.error("Error in Get Vendor Pending Content List", error);
    return res.status(500).json({
      Message: "Something Went Wrong",
      error: error.message
    })
  }
}

export const getVendorCampaignStatusOverview = async (req, res) => {
  const p_userid = req.user?.id || req.query.p_userid;

  if (!p_userid) return res.status(400).json({ Message: "User Id Required For Get Campaign Status OverView" });

  try {
    const campaignStatusOverview = await client.query(
      `select * from ins.fn_get_vendorcampaignstatusoverview($1::bigint)`, [p_userid]);

    const campaignStatusOverviewRes = campaignStatusOverview.rows[0].fn_get_vendorcampaignstatusoverview;

    return res.status(200).json({
      Message: "Campaign OverView Get Sucessfully",
      data: campaignStatusOverviewRes,
      source: "db"
    });
  } catch (error) {
    console.error("Error In Getting  Vendor campaign status overview", error);
    return res.status(500).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
}

export const getVendorDashboardFeedbackList = async (req, res) => {
  const p_userid = req.user?.id || req.query.p_userid
  if (!p_userid) return res.status(400).json({ Message: "User Id Required For Getting Feedback" })
  try {
    const vendorFeedback = await client.query(`
        SELECT * FROM ins.fn_get_vendordashboardfeedbacklist($1::bigint)`, [p_userid]);

    const vendorFeedbackRes = vendorFeedback.rows[0].fn_get_vendordashboardfeedbacklist || [];
    return res.status(200).json({
      Message: "Vendor Feedback Getting Successfully",
      data: vendorFeedbackRes,
      source: 'db'
    })
  } catch (error) {
    console.error("Error While Getting Feedback", error)
    return res.status(500).json({
      Message: "Something Went Wrong. Please Try Again Later",
      error: error.message
    })
  }
}

export const getCampaignStatusTrend = async (req, res) => {
  const p_userid = req.user?.id;
  if (!p_userid) return res.status(400).json({ message: "User Id Required For Get Campaign Status Trend" });
  const p_filtertype = req.query.p_filtertype || 'year'
  try {
    const campaignStatusTrend = await client.query(`
      select * from ins.fn_get_campaignstatustrend($1::bigint,$2::varchar)`, [p_userid, p_filtertype]);
    const campaignStatusTrendRes = campaignStatusTrend.rows[0].fn_get_campaignstatustrend || [];
    return res.status(200).json({
      message: "Campaign Status Trend retrieved successfully",
      data: campaignStatusTrendRes,
      source: 'db'
    })
  } catch (error) {
    console.error("Error While Getting Campaign Status Trend", error);
    return res.status(500).json({
      message: "Internal server Error",
      error: error.message
    })
  }
}
