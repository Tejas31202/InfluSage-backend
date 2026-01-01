import { client } from '../../config/Db.js';
import { sendingMailFormatForAdmin } from '../../utils/MailUtils.js';
import {
  userProfileEmailHTML,
  campaignEmailHTML,
  userProfileBlockEmailHTML,
  userProfileRejectEmailHTML,
  campaignRejectEmailHTML,
  userCampaignBlockEmailHTML
} from "../../utils/EmailTemplates.js";
import { io } from '../../../app.js'


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
      message: "Something went wrong. Please try again later.",
      error: error.message,
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
      message: "Something went wrong. Please try again later.",
      error: error.message,
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
    return res.status(500).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
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
    return res.status(500).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
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
    return res.status(500).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};

export const insertApprovedOrRejectedApplication = async (req, res) => {
  const p_adminid = req.user.id;
  const { p_userid, p_campaignid } = req.body;

  if (!p_adminid && !p_userid) {
    return res.status(400).json({
      message: "Required field missing: p_adminid or p_userid must be specified.",
    });
  }

  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT set_config('app.current_user_id', $1, true)",
      [String(p_adminid)]
    );
    const result = await client.query(
      `CALL ins.usp_update_approvalstatus(
        $1::bigint,
        $2::bigint,
        $3::bigint,
        $4::smallint,
        $5::character
      );`,
      [p_adminid, p_userid || null, p_campaignid || null, null, null]
    );
    await client.query("COMMIT");
    const row = result.rows?.[0] || {};
    const p_status = Number(row.p_status);
    const p_message = row.p_message;
    // ----------------- HANDLE p_status -----------------
    if (p_status === 1) {
      // Proceed with emails + notifications as before
      let recipientId = null;
      let email = null;
      let firstName = null;
      let campaignName = null;
      // ------------------
      // USER APPROVAL 
      // ------------------
      if (p_userid && !p_campaignid) {
        const userResult = await client.query(
          `SELECT id, firstname, email FROM ins.users WHERE id = $1`,
          [p_userid]
        );
        const user = userResult.rows[0];
        if (!user) return res.status(404).json({ message: p_message || "User not found" });
        recipientId = user.id;
        email = user.email;
        firstName = user.firstname;
        await sendingMailFormatForAdmin(
          email,
          `Your Profile Approved`,
          userProfileEmailHTML({ userName: firstName })
        );
        res.status(200).json({
          p_status,
          message: p_message,
          source: "db",
        });
      }
      // CAMPAIGN APPROVAL 
      else if (p_campaignid && !p_userid) {
        const campaignOwnerResult = await client.query(
          `SELECT 
            c.name AS campaignname,
            u.id AS ownerid,
            u.firstname,
            u.email
          FROM ins.campaigns c
          INNER JOIN ins.users u ON u.id = c.ownerid
          WHERE c.id = $1`,
          [p_campaignid]
        );
        const data = campaignOwnerResult.rows[0];
        if (!data) {
          return res.status(404).json({ message: p_message || "Campaign or owner not found" });
        }
        recipientId = data.ownerid;
        email = data.email;
        firstName = data.firstname;
        campaignName = data.campaignname;
        await sendingMailFormatForAdmin(
          email,
          `Your Campaign Approved`,
          campaignEmailHTML({
            userName: firstName,
            campaignName,
            status: "Approved",
          })
        );
        res.status(200).json({
          p_status,
          message: p_message,
          source: "db",
        });
      }
      // -----------------------------------
      // FETCH NOTIFICATIONS + SOCKET EMIT
      // -----------------------------------
      const p_role = 'RECEIVER';
      if (recipientId) {
        const notificationRes = await client.query(
          `SELECT * FROM ins.fn_get_notificationlist($1::bigint, $2::boolean, $3::text)`,
          [recipientId, null, p_role]
        );
        const notifyData =
          notificationRes.rows[0]?.fn_get_notificationlist || [];
        if (notifyData.length === 0) {
          // console.log("No notifications found.");
          return;
        }
        const latest = notifyData[0];
        const toUserId = latest.receiverid;
        if (!toUserId) return;
        io.to(`user_${toUserId}`).emit("receiveNotification", latest);
      }
      // return res.status(200).json({
      //   message: p_message,
      //   status: p_status
      // });
    }
    // Case 2: p_status = 0 → DB validation fail
    else if (p_status === 0) {
      return res.status(400).json({
        status: p_status,
        message: p_message || "Validation failed"
      });
    }
    // Case 3: p_status = -1 → SP failed
    else if (p_status === -1) {
      console.error("Stored Procedure Failure:", p_message);
      return res.status(500).json({
        status: p_status,
        message: "Something went wrong. Please try again later."
      });
    }
    // Fallback: unexpected value
    else {
      return res.status(500).json({
        status: false,
        message: "Unexpected database response",
      });
    }
  } catch (error) {
    console.error("Error in insertApprovedOrRejectedApplication:", error);
    return res.status(500).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};

//changes for getalluserdetails
export const getUserDetails = async (req, res) => {
  try {
    const p_userid = req.query.p_userid || req.body.p_userid;
    if (!p_userid) {
      return res.status(400).json({
        message: "User ID is required to fetch user details.",
      });
    }
    const result = await client.query(
      "SELECT * FROM ins.fn_get_userdetails($1::bigint)",
      [p_userid]
    );
    const allDetails = result.rows[0].fn_get_userdetails[0];
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
    console.error("Error in getUserDetails:", error);
    return res.status(500).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};

export const getCampaignDetails = async (req, res) => {
  try {
    const p_campaignid = req.query.p_campaignid || req.body.p_campaignid;
    if (!p_campaignid) {
      return res.status(400).json({
        message: "p_campaignid is required to fetch camapign details.",
      });
    }
    const result = await client.query(
      "select * from ins.fn_get_campaignmanagementdetails($1::bigint);",
      [p_campaignid]
    );
    const campaign = result.rows[0].fn_get_campaignmanagementdetails[0];
    return res.status(200).json({
      message: "campaign details fetched successfully.",
      campaignDetails: campaign,
      source: "db",
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const campaignBlockReason = async (req, res) => {
  try {
    const result = await client.query("SELECT * FROM ins.fn_get_campaignblockreason();");
    const BlockReason = result.rows;
    return res.status(200).json({
      message: "Campaign Block Reasons fetched successfully",
      data: BlockReason
    });
  } catch (error) {
    console.error("Error fetching Campaign Block Reason:", error);
    return res.status(500).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};

export const userBlockReason = async (req, res) => {
  try {
    const result = await client.query("SELECT * FROM ins.fn_get_userblockreason();");
    return res.status(200).json({
      message: "User Block Reasons fetched successfully",
      data: result.rows,
    });
  } catch (error) {
    console.error("Error fetching User Block Reason:", error);
    return res.status(500).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};

export const blockInfluencerAndCampaignApplication = async (req, res) => {
  const p_adminid = req.user?.id || req.body.p_adminid;
  const { p_userid, p_campaignid, p_objective } = req.body;
  if (!p_userid && !p_campaignid) {
    return res.status(400).json({
      message: "Required field missing: p_userid or p_campaignid must be specified.",
    });
  }
  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT set_config('app.current_user_id', $1, true)",
      [String(p_adminid)]
    );
    const result = await client.query(
      `CALL ins.usp_insert_entityblock(
        $1::bigint,
        $2::bigint,
        $3::bigint,
        $4::smallint,
        $5::smallint,
        $6::text
      );`,
      [p_adminid, p_userid || null, p_campaignid || null, p_objective, null, null]
    );
    await client.query("COMMIT");
    const row = result.rows[0] || {};
    const p_status = Number(row.p_status);
    const p_message = row.p_message;
    // -------------------------------
    //       STATUS HANDLING
    // -------------------------------
    if (p_status === 1) {
      let recipientId = null;
      // -------------------------------
      // USER BLOCK → EMAIL + SOCKET
      // -------------------------------
      if (p_userid && !p_campaignid) {
        const userResult = await client.query(
          `SELECT id, firstname, email FROM ins.users WHERE id = $1`,
          [p_userid]
        );
        const user = userResult.rows[0];
        if (!user) return res.status(404).json({ message: "User not found" });
        recipientId = user.id;
        await sendingMailFormatForAdmin(
          user.email,
          `Your Profile blocked by influsage admin team`,
          userProfileBlockEmailHTML({ userName: user.firstname })
        );
        res.status(200).json({
          p_status,
          message: p_message,
          source: "db",
        });
      }
      // -------------------------------
      // CAMPAIGN BLOCK → EMAIL + SOCKET
      // -------------------------------
      else if (p_campaignid && !p_userid) {
        const campaignOwner = await client.query(
          `SELECT 
              u.id AS ownerid,
              u.firstname,
              u.email,
              c.name AS campaignname
           FROM ins.campaigns c
           INNER JOIN ins.users u ON u.id = c.ownerid
           WHERE c.id = $1`,
          [p_campaignid]
        );
        const data = campaignOwner.rows[0];
        if (!data) return res.status(404).json({ message: "Campaign or owner not found" });
        recipientId = data.ownerid;
        await sendingMailFormatForAdmin(
          data.email,
          `Your Campaign blocked by influsage admin team`,
          userCampaignBlockEmailHTML({
            userName: data.firstname,
            campaignName: data.campaignname
          })
        );
        res.status(200).json({
          p_status,
          message: p_message,
          source: "db",
        });
      }
      // Safety fallback
      else {
        return res.status(400).json({
          message: "Invalid request: provide either userId or campaignId",
        });
      }
      // -------------------------------
      // SOCKET NOTIFICATIONS
      // -------------------------------
      const p_role = 'RECEIVER';
      if (recipientId) {
        const notificationRes = await client.query(
          `SELECT * FROM ins.fn_get_notificationlist($1::bigint, $2::boolean, $3::text)`,
          [recipientId, null, p_role]
        );
        const notifyData = notificationRes.rows[0]?.fn_get_notificationlist || [];
        if (notifyData.length === 0) {
          // console.log("No notifications found.");
          return;
        }
        const latest = notifyData[0];
        const toUserId = latest.receiverid;
        if (!toUserId) return;

        io.to(`user_${toUserId}`).emit("receiveNotification", notifyData);
      }
    }
    // VALIDATION FAIL → p_status = 0
    else if (p_status === 0) {
      return res.status(400).json({ message: p_message || "Validation failed", status: false, p_status });
    }
    // SP FAILED → p_status = -1
    else if (p_status === -1) {
      console.error("Stored Procedure Failure:", p_message);
      return res.status(500).json({
        message: "Something went wrong. Please try again later.",
        status: false,
        p_status
      });
    }
    // Unexpected fallback
    else {
      return res.status(500).json({
        message: "Unexpected database response",
        status: false,
        p_status
      });
    }
  } catch (error) {
    console.error("Error in blockInfluencerApplication:", error);
    return res.status(500).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};

export const adminRejectInfluencerOrCampaign = async (req, res) => {
  try {
    const p_adminid = req.user?.id || req.body.p_adminid;
    if (!p_adminid) {
      return res.status(400).json({ message: "p_adminid is required." });
    }
    const { p_userid, p_campaignid, p_text } = req.body;
    if (!p_userid && !p_campaignid) {
      return res
        .status(400)
        .json({ message: "Please provide either p_userid or p_campaignid." });
    }
    if (!p_text) {
      return res.status(400).json({ message: " p_text is required." });
    }
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.current_user_id', $1, true)", [
      String(p_adminid),
    ]);
    // Store rejection info in DB
    const result = await client.query(
      `CALL ins.usp_upsert_rejectentity(
        $1::bigint,
        $2::bigint,
        $3::bigint,
        $4::varchar,
        $5::smallint,
        $6::varchar
      );`,
      [p_adminid, p_userid || null, p_campaignid || null, p_text, null, null]
    );
    await client.query("COMMIT");
    const { p_status, p_message } = result.rows[0];
    if (p_status === 1) {
      //  1️⃣ Influencer Rejection
      if (p_userid && !p_campaignid) {
        const userResult = await client.query(
          "SELECT firstname, email FROM ins.users WHERE id = $1",
          [p_userid]
        );
        const user = userResult.rows[0];
        if (!user) {
          return res.status(404).json({
            message: "User not found.",
          });
        }
        // Send user profile rejection email
        await sendingMailFormatForAdmin(
          user.email,
          `Your profile has been rejected by the InfluSage Admin Team`,
          userProfileRejectEmailHTML({
            userName: user.firstname,
            reason: p_text,
          })
        );
        return res.status(200).json({
          message: p_message,
          p_status,
          source: "db",
        });
      }
      // 2️⃣ CAMPAIGN REJECTION CASE
      if (p_campaignid && !p_userid) {
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
        const campaignData = campaignOwnerResult.rows[0];
        if (!campaignData) {
          return res.status(404).json({
            message: "Campaign or owner not found.",
          });
        }
        // Send campaign rejection email
        await sendingMailFormatForAdmin(
          campaignData.email,
          `Your campaign has been rejected by the InfluSage Admin Team`,
          campaignRejectEmailHTML({
            userName: campaignData.firstname,
            campaignName: campaignData.campaignname,
            reason: p_text,
          })
        );
        return res.status(200).json({
          message: p_message,
          p_status,
          source: "db",
        });
      }
    } // VALIDATION FAIL → p_status = 0
    else if (p_status === 0) {
      return res
        .status(400)
        .json({
          message: p_message || "Validation failed",
          status: false,
          p_status,
        });
    }
    // SP FAILED → p_status = -1
    else if (p_status === -1) {
      console.error("Stored Procedure Failure:", p_message);
      return res.status(500).json({
        message: "Something went wrong. Please try again later.",
        status: false,
        p_status,
      });
    }
    // Unexpected fallback
    else {
      return res.status(500).json({
        message: "Unexpected database response",
        status: false,
        p_status,
      });
    }
  } catch (error) {
    console.error("Error in adminRejectInfluencerOrCampaign:", error);
    return res.status(500).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};

export const getMessageManagement = async (req, res) => {
  const p_userid = req.user?.id;
  if (!p_userid) return res.status(400).json({ Message: "User ID required For Message Management" });
  try {
    const p_pagenumber = Number(req.query.p_pagenumber) || 1
    const p_pagesize = Number(req.query.p_pagesize) || 20
    const p_search = req.query.p_search || null
    const messageManagementRes = await client.query(`SELECT * FROM ins.fn_get_messagemanagement($1::integer,$2::integer,$3::text)`,
      [
        p_pagenumber,
        p_pagesize,
        p_search
      ]
    );
    const responseData = messageManagementRes.rows[0].fn_get_messagemanagement;
    return res.status(200).json({
      Message: "Message management fetched successfully",
      data: responseData,
      source: 'db'
    })
  } catch (error) {
    console.error("Error fetching Message Management:", error);
    return res.status(500).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
}
