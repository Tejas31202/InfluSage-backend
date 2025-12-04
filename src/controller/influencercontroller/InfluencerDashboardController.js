import { client } from '../../config/Db.js';

export const getInfluencerDashsboardCountList = async (req, res) => {
  try {
    const p_userid = req.user?.id || req.body.p_userid;
    const result = await client.query(
      "SELECT * FROM ins.fn_get_influencerdashboard($1::bigint);",
      [p_userid]
    );

    const countList = result.rows[0].fn_get_influencerdashboard;

    return res.status(200).json({
      message: "Fetched getInfluencerDesboardCountList.",
      data: countList,
      source: "db",
    });
  } catch (error) {
    console.error("Error in getInfluencerDesboardCountList:", error);
    return res.status(500).json({
      message: error.message,
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

    return res.status(200).json({
      message: "Profile completion percentage fetched successfully.",
      percentage: percentage,
      source: "db",
    });
  } catch (error) {
    console.error("Error in getInfluencerProfileCompletionPercentage:", error);
    return res.status(500).json({
      message: error.message,
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

    return res.status(200).json({
      message: "Fetched todo list.",
      data: todo,
      source: "db",
    });
  } catch (error) {
    console.error("Error in getSingleToDo:", error);
    return res.status(500).json({
      message: error.message,
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

    const result = await client.query(
      `CALL ins.usp_upsert_todolist(
      $1::bigint, 
      $2::bigint, 
      $3::text, 
      $4::date, 
      $5::boolean, 
      $6::boolean,
      $7::boolean,
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

    const { p_status, p_message } = result.rows[0];

    if (p_status) {
      return res.status(200).json({
        message: p_message,
        source: "db",
      });
    } else {
      return res.status(400).json({
        message: p_message,
        status: p_status,
      });
    }
  } catch (error) {
    console.error("Error in insertOrEditToDo:", error);
    return res.status(500).json({
      message: error.message,
    });
  }
};

export const getInfluencerFeedBack = async (req, res) => {
  const p_userid = req.user?.id;

  if (!p_userid) {
    return res.status(400).json({
      Message: "User Id Required for Feedback"
    });
  }

  try {
    const influencerFeedback = await client.query(
      `SELECT * FROM ins.fn_get_influencerfeedbacklist($1::BIGINT)`,
      [p_userid]
    );

    const feedBackResult = influencerFeedback.rows[0].fn_get_influencerfeedbacklist;

    if (!feedBackResult.length) {
      return res.status(404).json({ Message: "Feedback Not Available" });
    }

    return res.status(200).json({
      Message: "Vendor Performance Summary Successfully Fetched",
      Data: feedBackResult,
      source: "db"
    });

  } catch (error) {
    console.error("Error in Get Vendor Performance Summary:", error);
    return res.status(500).json({
      Message: "Internal Server Error",
      Error: error.message
    });
  }
};