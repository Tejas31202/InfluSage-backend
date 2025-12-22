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

// export const getTotalVendorCampaigns = async (req, res) => {
//   try {
//     const p_userid = req.user?.id || req.body.p_userid;
//     if (!p_userid) {
//       return res.status(400).json({
//         message: "User ID is required to fetch total campaigns.",
//       });
//     }
//     const result = await client.query(
//       "SELECT * FROM ins.fn_total_vendorcampaigns($1::bigint)",
//       [p_userid]
//     );
//     if (result.rowCount === 0 || !result.rows[0]) {
//       return res.status(404).json({
//         message: "No data found for the given user.",
//       });
//     }
//     const totalCampaigns = result.rows[0].fn_total_vendorcampaigns;
//     return res.status(200).json({
//       message: "Total vendor campaigns fetched successfully.",
//       totalCampaigns: totalCampaigns,
//       source: "db",
//     });
//   } catch (error) {
//     console.error("Error in getTotalVendorCampaigns:", error);
//     return res.status(500).json({
//       message: "Something went wrong. Please try again later.",
//       error: error.message,
//     });
//   }
// };

// export const getCampaignSummary = async (req, res) => {
//   try {
//     const p_userid = req.user?.id || req.body.p_userid;
//     if (!p_userid) {
//       return res.status(400).json({
//         message: "User ID is required to fetch campaign summary.",
//       });
//     }
//     const result = await client.query(
//       "SELECT * FROM ins.fn_vendor_campaignsummary($1::bigint)",
//       [p_userid]
//     );
//     if (result.rowCount === 0 || !result.rows[0]) {
//       return res.status(404).json({
//         message: "No data found for the given user.",
//       });
//     }
//     const summary = result.rows[0];
//     return res.status(200).json({
//       message: "Campaign summary fetched successfully.",
//       summary: summary,
//       source: "db",
//     });
//   } catch (error) {
//     console.error("Error in getCampaignSummary:", error);
//     return res.status(500).json({
//       message: "Something went wrong. Please try again later.",
//       error: error.message,
//     });
//   }
// };



// export const getVendorRecentCampaigns = async (req, res) => {
//   try {
//     const p_userid = req.user?.id || req.body.p_userid;
//     if (!p_userid) {
//       return res
//         .status(400)
//         .json({ message: "User ID is required to fetch recent campaigns." });
//     }
//     const result = await client.query(
//       "SELECT * FROM ins.fn_vendor_recentcampaigns($1::bigint)",
//       [p_userid]
//     );
//     if (result.rowCount === 0 || !result.rows[0]) {
//       return res
//         .status(404)
//         .json({ message: "No recent campaigns found for the given user." });
//     }
//     const recentCampaigns = result.rows[0].fn_vendor_recentcampaigns;
//     return res.status(200).json({
//       message: "Recent vendor campaigns fetched successfully.",
//       recentCampaigns: recentCampaigns,
//       source: "db",
//     });
//   } catch (error) {
//     console.error("Error in getVendorRecentCampaigns:", error);
//     return res.status(500).json({
//       message: "Something went wrong. Please try again later.",
//       error: error.message,
//     });
//   }
// };

// export const getVendorRecentApplications = async (req, res) => {
//   try {
//     const vendorId = req.user.id;

//     const result = await client.query(
//       `SELECT * FROM ins.fn_vendor_recent_applications($1, $2)`,
//       [vendorId, 5] // 5 is the limit
//     );

//     return res.status(200).json({
//       status: true,
//       data: result.rows,
//     });
//   } catch (error) {
//     console.error("error in getVendorRecentApplications:")
//     return res.status(500).json({
//       message: "Something went wrong. Please try again later.",
//       error: error.message,
//     });
//   }
// };

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

