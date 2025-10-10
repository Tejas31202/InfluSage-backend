import { client } from '../config/Db.js';

export const getAdminPanelStatusList = async (req, res) => {
  try {
    const result = await client.query("select * from ins.fn_get_staus();");

    const status = result.rows;

    return res.status(200).json({
      message: "fatching get user status",
      data: status,
      source: "db",
    });
  } catch (error) {
    console.error("Error fetching getAdminPanelStatusList:", error);
    return res.status(500).json({ message: error.message });
  }
};

export const getDashboardCountList = async (req, res) => {
  // pendingUser,approveUser,pendingCampaign,approveCampaign ==> function return this fields
  try {
    const result = await client.query(
      "select * from ins.fn_get_dashbordCount();"
    );

    const data = result.rows;

    return res.status(200).json({
      message: "fatching getDashboardCountList",
      data: data,
      source: "db",
    });
  } catch (error) {
    console.error("Error fetching getDashboardCountList:", error);
    return res.status(500).json({ message: error.message });
  }
};

export const getRequestedUserList = async (req, res) => {
  const {
    p_search,
    p_page,
    p_limit,
    p_sortby,
    p_sortorder,
    p_location,
    p_followers,
    p_plateform,
    p_language,
    p_gender,
  } = req.query;
  try {
    const result = await client.query(
      "select * from ins.fn_get_dashbordCount();",
      [
        p_search,
        p_page,
        p_limit,
        p_sortby,
        p_sortorder,
        p_location,
        p_followers,
        p_plateform,
        p_language,
        p_gender,
      ]
    );

    const data = result.rows;

    return res.status(200).json({
      message: "fatching getRequestedUserList",
      data: data,
      source: "db",
    });
  } catch (error) {
    console.error("Error fetching getRequestedUserList:", error);
    return res.status(500).json({ message: error.message });
  }
};

export const getRequestedCampaignList = async (req, res) => {
  const {
    p_search,
    p_page,
    p_limit,
    p_location,
    p_followers,
    p_plateform,
    p_language,
    p_gender,
    p_sortby,
    p_sortorder,
  } = req.query;
  try {
    const result = await client.query(
      "select * from ins.fn_get_dashbordCount();",
      [
        p_search,
        p_page,
        p_limit,
        p_location,
        p_followers,
        p_plateform,
        p_language,
        p_gender,
        p_sortby,
        p_sortorder,
      ]
    );

    const data = result.rows;

    return res.status(200).json({
      message: "fatching getRequestedCampaignList",
      data: data,
      source: "db",
    });
  } catch (error) {
    console.error("Error fetching getRequestedCampaignList:", error);
    return res.status(500).json({ message: error.message });
  }
};

export const insertApprovedAndRejectedApplication = async (req, res) => {
  const { campaignId, userId, status } = req.body;
  try {
    const result = await client.query(`Call ins.usp_insert_action();`, [
      campaignId || null,
      userId || null,
      status,
      null,
      null,
    ]);
    const { p_status, p_message } = result.rows[0];
    if (p_status) {
      return res.status(200).json({ message: p_message, source: "db" });
    } else {
      return res.status(400).json({ message: p_message, p_status });
    }
  } catch (error) {
    console.error(
      "Error fetching in insertApprovedAndRejectedApplication:",
      error
    );
    return res.status(500).json({ message: error.message });
  }
};
