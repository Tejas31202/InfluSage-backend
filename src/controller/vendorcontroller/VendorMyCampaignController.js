import { client } from '../../config/Db.js';


//...............Get All Campaign......................
export const getMyAllCampaign = async (req, res) => {
  try {
    const p_userid = req.user?.id || req.body.p_userid;
    const {
      p_statuslabelid,
      p_providers,
      p_status,
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

    const result = await client.query(
      `SELECT * FROM ins.fn_get_mycampaign(
    $1::bigint,
    $2::smallint,
    $3::json,
    $4::json,
    $5::numeric,
    $6::numeric,
    $7::date,
    $8::date,
    $9::text,
    $10::text,
    $11::integer,
    $12::integer,
    $13::text
    )`,
      [
        p_userid,
        p_statuslabelid || null,
        p_providers || null,
        p_status || null,
        p_maxbudget || null,
        p_minbudget || null,
        p_startdate || null,
        p_enddate || null,
        p_sortby || "startdate",
        p_sortorder || "DESC",
        p_pagenumber || 1,
        p_pagesize || 20,
        p_search || null,
      ]
    );

    if (!result.rows) {
      return res.status(404).json({ message: "campaign not found." });
    }

    const Allcampaign = result.rows[0].fn_get_mycampaign;

    return res.status(200).json({
      data: Allcampaign,
      source: "db",
    });
  } catch (error) {
    console.error("Error in getMyAllCampaign:", error);
    return res.status(500).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};
//.............Get Campaign Status....................
export const getCampaignStatus = async (req, res) => {
  try {
    const result = await client.query(
      `SELECT * FROM ins.fn_get_mycampaignstatus()`
    );

    if (!result) {
      return res.status(400).json({ message: "No Status Available." });
    }

    const status = result.rows;

    return res.status(200).json({
      message: "sucessfuly get status",
      data: status,
    });
  } catch (error) {
    console.error("Error in get status :", error);
    return res.status(500).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};
//..............Get SingleCampaign.....................
export const getSingleCampaign = async (req, res) => {

  const p_campaignid = req.params.p_campaignid;

  try {

    if (!p_campaignid) {
      return res.status(400).json({ message: 'Campaign ID Is Require' })
    }

    const result = await client.query(
      `SELECT * FROM ins.fn_get_mycampaigndetails($1::BIGINT)`,
      [p_campaignid]
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    const singleCampaign = result.rows[0]?.fn_get_mycampaigndetails[0];

    return res.status(200).json({
      message: 'Single Campaign Get Sucessfully',
      data: singleCampaign,
      source: 'db'
    });

  } catch (error) {
    console.error('Error Getting Campaign', error);
    return res.status(500).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
}
//..............Get Cancle Reason List..................
export const getCancleReasonList = async (req, res) => {
  try {
    const result = await client.query(
      `select * from ins.fn_get_campaigncancelreason();`
    );

    const reasons = result.rows;

    return res.status(200).json({
      message: "Fetch cancellation reason list",
      data: reasons,
      source: "db",
    });
  } catch (error) {
    console.error("Error getCancleReasonList : ", error);
    return res.status(500).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};
//..............Insert Campaign a
export const insertCampiginCancleApplication = async (req, res) => {
  const userId = req.user?.id || req.body.userId;
  const { p_campaignid, p_objectiveid } = req.body || {};

  if (!p_campaignid || !p_objectiveid) {
    res.status(400).json({ message: "required fields are :  p_campaignid and  p_objectiveid" })
  }
  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT set_config('app.current_user_id', $1, true)",
      [String(userId)]
    );
    const result = await client.query(
      `CALL ins.usp_upsert_campaigncacelreason(
      $1::bigint, 
      $2::bigint, 
      $3::smallint, 
      $4::smallint, 
      $5::varchar
    );`,
      [userId, p_campaignid, p_objectiveid, null, null]
    );
    await client.query("COMMIT");

    const row = result.rows[0] || {};
    const p_status = Number(row.p_status);
    const p_message = row.p_message;

    // ----------------- HANDLE p_status -----------------
    if (p_status === 1) {
      return res.status(200).json({
        message: p_message || "Cancellation reason submitted successfully",
        source: "db",
      });
    }
    else if (p_status === 0) {
      return res.status(400).json({
        message: p_message || "Validation failed",
        p_status,
        source: "db",
      });
    }
    else if (p_status === -1) {
      console.error("Stored Procedure Failure:", p_message);
      return res.status(500).json({
        message: "Something went wrong. Please try again later.",
        p_status: false,
      });
    }
    else {
      return res.status(500).json({
        message: "Unexpected database response",
        p_status: false,
      });
    }
  } catch (error) {
    console.error("error in cancle campaigin application :", error);
    return res.status(500).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};

export const pausedCampaignApplication = async (req, res) => {
  const userId = req.user?.id || req.body.userId;

  if (!userId) {
    return res.status(401).json({
      status: false,
      message: "Unauthorized: user not found",
    });
  }
  const p_campaignid = req.params.p_campaignid;
  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT set_config('app.current_user_id', $1, true)",
      [String(userId)]
    );
    const result = await client.query(
      `CALL ins.usp_update_changecampaignstatus(
      $1::bigint,
      $2::boolean,
      $3::varchar
    )`,
      [p_campaignid, null, null]
    );
    await client.query("COMMIT");

    const { p_status, p_message } = result.rows[0];
    if (p_status) {
      return res.status(200).json({ message: p_message, source: "db" });
    } else {
      return res.status(400).json({ message: p_message, p_status });
    }
  } catch (error) {
    console.error("Error in Paused Campaign Application:", error);
    return res.status(500).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};

export const getCampaignInvitationList = async (req, res) => {
  const p_userid = req.user?.id || req.query.p_userid;
  if (!p_userid) return res.status(400).json({ message: "User Id Required For Campaign Invitation List" });
  try {
    const p_campaignid = req.query.p_campaignid;
    if (!p_campaignid) return res.status(400).json({ message: "Campaign Id Required" })
    const p_limit = Number(req.query.p_limit) || 20;
    console.log("limit:-", p_limit)
    const p_offset = Number(req.query.p_offset) || 0;
    console.log("offset:-",p_offset)

    const invitationList = await client.query(`
      select * from ins.fn_get_campaigninvitationlist($1::bigint,$2::bigint,$3::integer,$4::integer)`,
      [p_userid, p_campaignid, p_limit, p_offset]
    );
    const invitationListRes = invitationList.rows[0].fn_get_campaigninvitationlist;
    console.log("Invitation List Result", invitationListRes);
    return res.status(200).json({
      message: "Campaign Invitation List Sucessfully Getting",
      data: invitationListRes,
      source: 'db'
    })
  } catch (error) {
    console.error("Error While Getting Campaign Invitation List", error);
    return res.status(500).json({
      message: "Internal Server Error",
      error: error.message
    })
  }
}