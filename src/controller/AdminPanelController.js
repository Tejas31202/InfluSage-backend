import { client } from '../config/Db.js';
import { sendingMailFormatForAdmin } from '../utils/MailUtils.js';
import {
  userProfileEmailHTML,
  campaignEmailHTML,
} from "../utils/EmailTemplates.js";

export const getUserStatusList = async (req, res) => {
  try {
    const result = await client.query(
      "SELECT * FROM ins.fn_get_userapprovalstatus();"
    );

    const statusList = result.rows;

    return res.status(200).json({
      message: "Fetched user approval status successfully.",
      data: statusList,
      source: "db",
    });
  } catch (error) {
    console.error("Error in getUserStatusList:", error);
    return res.status(500).json({
      message: error.message,
    });
  }
};

export const getCampaignStatusList = async (req, res) => {
  try {
    const result = await client.query(
      "SELECT * FROM ins.fn_get_campaignapprovalstatus();"
    );

    const statusList = result.rows;

    return res.status(200).json({
      message: "Fetched campaign approval status successfully.",
      data: statusList,
      source: "db",
    });
  } catch (error) {
    console.error("Error in getCampaignStatusList:", error);
    return res.status(500).json({
      message: error.message,
    });
  }
}

export const getDashboardCountList = async (req, res) => {
  try {
    const result = await client.query(
      "select * from ins.fn_get_admindashboard();"
    );

    const data = result.rows[0].fn_get_admindashboard[0];

    return res.status(200).json({
      message: "fatching Admin Dashboard Details",
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
    p_statuslabelid,
    p_location,
    p_providers,
    p_influencertiers,
    p_genders,
    p_pagenumber,
    p_pagesize,
    p_search,
  } = req.query;
  try {
    const result = await client.query(
      `select * from ins.fn_get_usermanagement(
      $1::smallint,
      $2::text,
      $3::json,
      $4::json,
      $5::json,
      $6::integer ,
      $7::integer ,
      $8::text
    );`,
      [
        p_statuslabelid || null,
        p_location || null,
        p_providers || null,
        p_influencertiers || null,
        p_genders || null,
        p_pagenumber || 1,
        p_pagesize || 20,
        p_search || null,
      ]
    );

    const data = result.rows[0].fn_get_usermanagement;

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
    p_statuslabelid,
    p_providers,
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
  try {
    const result = await client.query(
      `select * from ins.fn_get_campaignmanagement(
      $1::smallint,
      $2::json,
      $3::numeric,
      $4::numeric,
      $5::date,
      $6::date,
      $7::text,
      $8::text,
      $9::integer,
      $10::integer,
      $11::text
      );`,
      [
        p_statuslabelid || null,
        p_providers || null,
        p_maxbudget || null,
        p_minbudget || null,
        p_startdate || null,
        p_enddate || null,
        p_sortby || "createddate",
        p_sortorder || "DESC",
        p_pagenumber || 1,
        p_pagesize || 20,
        p_search || null,
      ]
    );

    const data = result.rows[0].fn_get_campaignmanagement;

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

export const insertApprovedOrRejectedApplication = async (req, res) => {
  const { p_userid, p_campaignid, p_statusname } = req.body;

  if (!p_userid && !p_campaignid) {
    return res.status(400).json({
      message:
        "Required field missing: p_userid or p_campaignid must be specified.",
    });
  }
  if (!p_statusname) {
    return res
      .status(400)
      .json({ message: "Required field missing : p_statusname" });
  }

  try {
    const result = await client.query(
      `CALL ins.usp_update_approvalstatus(
      $1::bigint,
      $2::bigint,
      $3::varchar,
      $4::boolean,
      $5::text);`,
      [p_userid || null, p_campaignid || null, p_statusname, null, null]
    );

    const { p_status, p_message } = result.rows[0];

    const actionableMessages = [
      "User Approved.",
      "User Rejected.",
      "User Blocked.",
      "Campaign Approved.",
      "Campaign Rejected.",
    ];

    if (!actionableMessages.includes(p_message)) {
      console.log("No email sent — DB message:", p_message);
      return res
        .status(200)
        .json({ message: p_message, p_status, source: "db" });
    }

    //  Decide who receives the email
    if (p_userid && !p_campaignid) {
      // Profile approval/rejection
      const userResult = await client.query(
        "SELECT firstname, email FROM ins.users WHERE id = $1",
        [p_userid]
      );
      const user = userResult.rows[0];

      await sendingMailFormatForAdmin(
        user.email,
        `Your Profile ${p_statusname}`,
        userProfileEmailHTML({ userName: user.firstname, status: p_statusname })
      );
    } else if (p_campaignid && !p_userid) {
      // Campaign approval/rejection
      const campaignOwnerResult = await client.query(
        `SELECT 
          c.name AS campaignname,
          u.firstname,
          u.email
        FROM ins.campaigns c
        INNER JOIN ins.users u ON u.id = c.ownerid
        WHERE c.id = $1`,
        [p_campaignid]
      );

      const data = campaignOwnerResult.rows[0];

      if (!data) {
        return res.status(404).json({ message: "Campaign or owner not found" });
      }

      // Send email to campaign owner
      await sendingMailFormatForAdmin(
        data.email,
        `Your Campaign ${p_statusname}`,
        campaignEmailHTML({
          userName: data.firstname,
          campaignName: data.campaignname,
          status: p_statusname,
        })
      );
    } else {
      return res.status(400).json({
        message: "Invalid request: provide either userId or campaignId",
      });
    }

    return res.status(200).json({ message: p_message, source: "db" });
  } catch (error) {
    console.error("Error in insertApprovedOrRejectedApplication:", error);
    return res.status(500).json({ message: error.message });
  }
};

//changes for getalluserdetails
export const getUserDetails = async (req, res) => {
  try {
    const p_userid = req.user?.id || req.body.p_userid;

    if (!p_userid) {
      return res.status(400).json({
        message: "User ID is required to fetch user details.",
      });
    }

    const result = await client.query(
      "SELECT * FROM ins.fn_get_userdetails($1::bigint)",
      [p_userid]
    );

    console.log("AllDetails ==>", result);

    const allDetails = result.rows[0].fn_get_userdetails;

    if (allDetails === 0 || !allDetails) {
      return res.status(404).json({
        message: "No user details found for the given ID.",
      });
    }

    return res.status(200).json({
      message: "User details fetched successfully.",
      userDetails: allDetails,
      source: "db",
    });
  } catch (error) {
    console.error("Error in getAllUserDetails:", error);
    return res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

