import { client } from '../../config/Db.js';
import { io } from '../../../app.js';
import { HTTP, SP_STATUS } from '../../utils/Constants.js';

export const getSelectInfluencerListForFeedback = async (req, res) => {
  try {
    const vendor_id = req.user?.id;
    const { campaign_id } = req.query;

    if (!campaign_id) {
      return res.status(HTTP.BAD_REQUEST).json({
        message: "campaign_id is required.",
      });
    }

    const result = await client.query(
      `select * from ins.fn_get_feedbackinfluencers($1::bigint,$2::bigint)`,
      [campaign_id, vendor_id]
    );

    const data = result.rows[0].fn_get_feedbackinfluencers || [];

    return res.status(HTTP.OK).json({
      message: "Selected influencers for feedback retrieved successfully.",
      data: data,
      source: "db",
    });
  } catch (error) {
    console.error("error in getSelectInfluencerListForFeedback", error);
    return res.status(HTTP.INTERNAL_ERROR).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
}

export const vendorInsertFeedback = async (req, res) => {
  const { p_contractid, p_rating, p_text } = req.body;
  const userId = req.user?.id || req.body.userId;
  if (!userId) {
    return res.status(HTTP.UNAUTHORIZED).json({
      status: false,
      message: "Unauthorized: user not found",
    });
  }
  if (!p_contractid) {
    return res.status(HTTP.BAD_REQUEST).json({ status: false, message: "Contract Id Required For Feedback" });
  }
  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT set_config('app.current_user_id', $1, true)",
      [String(userId)]
    );
    const insertFeedback = await client.query(`
      CALL ins.usp_upsert_feedback(
        $1::bigint,
        $2::smallint,
        $3::text,
        $4::smallint,
        $5::text
      )
    `,
      [
        p_contractid,
        p_rating || null,
        p_text || null,
        null,
        null
      ]);

    await client.query("COMMIT");

    const feedbackRow = insertFeedback.rows?.[0] || {};
    const p_status = Number(feedbackRow.p_status);
    const p_message = feedbackRow.p_message;

    if (p_status === SP_STATUS.SUCCESS) {
      try {
        const p_role = "SENDER"; // role sending the notification

        const notification = await client.query(
          `SELECT * FROM ins.fn_get_notificationlist($1::bigint, $2::boolean, $3::text)`,
          [userId, null, p_role]
        );

        const notifyData = notification.rows[0]?.fn_get_notificationlist || [];

        notifyData.forEach(latest => {
          const toUserId = latest.receiverid;
          console.log("Notification receiver toUserId:", toUserId); // log receiver
          if (toUserId) {
            io.to(`notification_${toUserId}`).emit("receiveNotification", latest);
            console.log(`Feedback notification sent to user_${toUserId}`);
          }
        });
      } catch (error) {
        console.error("Notification error:", error);
      }
      return res.status(HTTP.OK).json({
        status: true,
        message: p_message,
        source: "db"
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
        status: p_status,
        message: "Something went wrong. Please try again later.",
      });
    } else {
      return res.status(HTTP.INTERNAL_ERROR).json({
        status: false,
        message: "Unexpected database response",
      });
    }
  } catch (error) {
    console.error("Error in vendorInsertFeedback:", error);
    return res.status(HTTP.INTERNAL_ERROR).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};

export const getInfluencerFeedbackList = async (req, res) => {
  try {
    const p_userid = req.user?.id || req.query.p_userid;

    if (!p_userid) {
      return res.status(HTTP.BAD_REQUEST).json({
        message: "p_userid is required.",
      });
    }

    const { p_influencerid , p_limit ,p_offset } = req.query || {};

    if (!p_influencerid) {
      return res.status(HTTP.BAD_REQUEST).json({
        message: "p_influencerid is required.",
      });
    }

    const result = await client.query(
      `select * from ins.fn_get_influencerfeedbacklist(
      $1::bigint,
      $2::bigint,
      $3::integer,
      $4::integer
      );`,
      [
        p_userid, 
        p_influencerid, 
        p_limit || 20, 
        p_offset || 1
      ]
    );

    const data = result.rows[0]?.fn_get_influencerfeedbacklist;

    return res.status(HTTP.OK).json({
      message: "Influencer feedback data retrieved successfully.",
      data: data,
      source: "db",
    });
  } catch (error) {
    console.error("error in getInfluencerFeedbackList:", error);
    return res.status(HTTP.INTERNAL_ERROR).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};