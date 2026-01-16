import { client } from '../../config/Db.js';
import { HTTP, SP_STATUS } from '../../utils/Constants.js';

export const getInfluencerDashsboardCountList = async (req, res) => {
  try {
    const p_userid = req.user?.id || req.body.p_userid;
    const result = await client.query(
      "SELECT * FROM ins.fn_get_influencerdashboard($1::bigint);",
      [p_userid]
    );

    const countList = result.rows[0].fn_get_influencerdashboard;

    return res.status(HTTP.OK).json({
      message: "Fetched getInfluencerDesboardCountList.",
      data: countList,
      source: "db",
    });
  } catch (error) {
    console.error("Error in getInfluencerDesboardCountList:", error);
    return res.status(HTTP.INTERNAL_ERROR).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};

export const getInfluencerProfileCompletionPercentage = async (req, res) => {
  try {
    const p_userid = req.user?.id || req.body.p_userid;
    const result = await client.query(
      "SELECT * FROM ins.fn_complete_influencerprofilepercentage($1::bigint);",
      [p_userid]
    );

    const percentage = result.rows[0].fn_complete_influencerprofilepercentage;

    return res.status(HTTP.OK).json({
      message: "Profile completion percentage fetched successfully.",
      percentage: percentage,
      source: "db",
    });
  } catch (error) {
    console.error("Error in getInfluencerProfileCompletionPercentage:", error);
    return res.status(HTTP.INTERNAL_ERROR).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};

export const getToDoList = async (req, res) => {
  try {
    const p_userid = req.user?.id || req.body.p_userid;
    const result = await client.query(
      "select * from ins.fn_get_todolist($1::bigint,$2::bigint);",
      [p_userid, null]
    );

    const todo = result.rows[0].fn_get_todolist;

    return res.status(HTTP.OK).json({
      message: "Fetched todo list.",
      data: todo,
      source: "db",
    });
  } catch (error) {
    console.error("Error in getToDoList:", error);
    return res.status(HTTP.INTERNAL_ERROR).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};

export const insertOrEditOrDeleteToDo = async (req, res) => {
  try {
    const p_userid = req.user?.id || req.body.p_userid;
    const {
      p_todolistid,
      p_description,
      p_duedate,
      p_iscompleted,
      p_isdeleted,
    } = req.body;

    await client.query("BEGIN");
    await client.query(
      "SELECT set_config('app.current_user_id', $1, true)",
      [String(p_userid)]
    );
    const result = await client.query(
      `CALL ins.usp_upsert_todolist(
      $1::bigint, 
      $2::bigint, 
      $3::text, 
      $4::date, 
      $5::boolean, 
      $6::boolean,
      $7::smallint,
      $8::varchar
      );`,
      [
        p_userid,
        p_todolistid || null,
        p_description || null,
        p_duedate || null,
        p_iscompleted || null,
        p_isdeleted || false,
        null,
        null,
      ]
    );
    await client.query("COMMIT");

    const row = result.rows[0] || {};
    const p_status = Number(row.p_status);
    const p_message = row.p_message;

    if (p_status === SP_STATUS.SUCCESS) {
      return res.status(HTTP.OK).json({
        status: true,
        message: p_message,
        source: "db",
      });
    } else if (p_status === SP_STATUS.VALIDATION_FAIL) {
      return res.status(HTTP.BAD_REQUEST).json({
        status: false,
        message: p_message,
        source: "db",
      });
    } else if (p_status === SP_STATUS.ERROR) {
      console.error("Stored Procedure Failure:", p_message);
      return res.status(HTTP.INTERNAL_ERROR).json({
        status: false,
        message: "Unexpected database error",
        source: "db",
      });
    } else {
      return res.status(HTTP.INTERNAL_ERROR).json({
        status: false,
        message: "Unknown database response",
        source: "db",
      });
    }
  } catch (error) {
    console.error("Error in insertOrEditToDo:", error);
    return res.status(HTTP.INTERNAL_ERROR).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};

export const getInfluencerFeedBack = async (req, res) => {
  const p_userid = req.user?.id;

  if (!p_userid) {
    return res.status(HTTP.BAD_REQUEST).json({
      Message: "User Id Required for Feedback"
    });
  }

  try {
    const influencerFeedback = await client.query(
      `SELECT * FROM ins.fn_get_influencerdashboardfeedbacklist($1::BIGINT)`,
      [p_userid]
    );

    const feedBackResult = influencerFeedback.rows[0]?.fn_get_influencerdashboardfeedbacklist || [];

    return res.status(HTTP.OK).json({
      Message: "Influencer feedback list retrieved successfully.",
      Data: feedBackResult,
      source: "db"
    });

  } catch (error) {
    console.error("Error in getInfluencerFeedBack:", error);
    return res.status(HTTP.INTERNAL_ERROR).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};

export const getInfluencerActiveCampaignlist = async (req, res) => {
  const p_userid = req.user?.id || req.query.p_userid;
  if (!p_userid) return res.status(HTTP.BAD_REQUEST).json({ Message: "User Id Required For Get Active Campaign List" });
  try {
    const activeCampaignList = await client.query(`
      select * from ins.fn_get_influenceractivecampaignlist($1::bigint)`,
      [p_userid]
    );
    const activeCampaignRes = activeCampaignList.rows[0].fn_get_influenceractivecampaignlist || [];
  
    return res.status(HTTP.OK).json({
      Message: "Influencer Active Campaign List sucessfully get",
      data: activeCampaignRes,
      source: "db"
    })
  } catch (error) {
    console.error("Error in getInfluencer Active Campaign List :", error);
    return res.status(HTTP.INTERNAL_ERROR).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
}

export const getInfluencerPendingContentList = async (req, res) => {
  const p_userid = req.user?.id || req.query.p_userid;
  if (!p_userid) return res.status(HTTP.BAD_REQUEST).json({ Message: "User Id Required For Get Pending Content List" });
  try {
    const pendingContetList = await client.query(`
      select * from ins.fn_get_influencerpendingcontenttypelist($1::bigint)`,
      [p_userid]
    );
    const pendingContentListRes = pendingContetList.rows[0].fn_get_influencerpendingcontenttypelist;
  
    return res.status(HTTP.OK).json({
      Message: "Pending Content List Get Sucessfully",
      data: pendingContentListRes,
      source: "db"
    })

  } catch (error) {
    console.error("Error in get Influencer Pending Content List:", error);
    return res.status(HTTP.INTERNAL_ERROR).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
}