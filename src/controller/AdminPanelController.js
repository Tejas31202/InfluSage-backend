import { client } from '../config/Db.js';
import { sendingMailFormatForAdmin } from '../utils/MailUtils.js';
import {userProfileEmailHTML,campaignEmailHTML} from '../utils/EmailTemplates.js'

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




export const insertApprovedOrRejectedApplication = async (req, res) => {
  const { p_userid, p_campaignid, p_statusname } = req.body; 
  // console.log("---->",req.body)

  if(!p_userid && !p_campaignid){
    return res.status(400).json({message:"Required field missing: p_userid or p_campaignid must be specified."})
  }
  if(!p_statusname){
    return res.status(400).json({message:"Required field missing : p_statusname"})
  }

  try {
    // 1️⃣ Call your DB procedure
    const result = await client.query(`CALL ins.usp_update_approvalstatus(
      $1::bigint,
      $2::bigint,
      $3::varchar,
      $4::boolean,
      $5::text);`, [
      p_userid || null,
      p_campaignid || null,
      p_statusname,
      null,
      null,
    ]);
    // console.log("db payload ==>", p_userid, p_campaignid, p_statusname )
    const { p_status, p_message } = result.rows[0];

     const actionableMessages = [
      "User Approved.",
      "User Rejected.",
      "Campaign Approved.",
      "Campaign Rejected."
    ];

    if (!actionableMessages.includes(p_message)) {
      console.log("No email sent — DB message:", p_message);
      return res.status(200).json({ message: p_message,p_status,source: "db" });
    }

    // 2️⃣ Decide who receives the email
    if (p_userid && !p_campaignid) {
      // console.log("-->going to profile if")
      // Profile approval/rejection
      const userResult = await client.query(
        "SELECT firstname, email FROM ins.users WHERE id = $1",
        [p_userid]
      );
      const user = userResult.rows[0];
      // console.log("user---->",userResult.rows[0])

      await sendingMailFormatForAdmin(
        user.email,
        `Your Profile ${p_statusname}`,
        userProfileEmailHTML({ userName: user.firstname,status:p_statusname })
      );

    } else if (p_campaignid && !p_userid) {
      // console.log("---->if camapin")
      // Campaign approval/rejection
      const campaignResult = await client.query(
        "SELECT name, ownerid FROM ins.campaigns WHERE id = $1",
        [p_campaignid]
      );
      const campaign = campaignResult.rows[0];

      const ownerResult = await client.query(
        "SELECT firstname, email FROM ins.users WHERE id = $1",
        [campaign.ownerid]
      );
      const owner = ownerResult.rows[0];

      // Send email to campaign owner 
      await sendingMailFormatForAdmin(
        owner.email,
        `Your Campaign ${p_statusname}`,
        campaignEmailHTML({ 
          userName:owner.firstname,
          campaignName: campaign.name, 
          status:p_statusname 
        })
      );
    } else {
      return res.status(400).json({ message: "Invalid request: provide either userId or campaignId" });
    }

    // 3️⃣ Response
    return res.status(200).json({ message: p_message, source: "db" });

  } catch (error) {
    console.error("Error in insertApprovedOrRejectedApplication:", error);
    return res.status(500).json({ message: error.message });
  }
};