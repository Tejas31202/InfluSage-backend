import { client } from '../../config/Db.js';

export const getSelectInfluencerListForFeedback = async (req, res) => {
  try {
    const vendor_id = req.user?.id;
    const { campaign_id } = req.query;

    if (!campaign_id) {
      return res.status(400).json({
        message: "campaign_id is required.",
      });
    }

    const result = await client.query(
      `select * from ins.fn_get_feedbackinfluencers($1::bigint,$2::bigint)`,
      [campaign_id, vendor_id]
    );

    const data = result.rows[0].fn_get_feedbackinfluencers || [];

    return res.status(200).json({
      message: "Selected influencers for feedback retrieved successfully.",
      data: data,
      source: "db",
    });
  } catch (error) {
    console.error("error in getSelectInfluencerListForFeedback", error);
    return res.status(500).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
}

export const vendorInsertFeedback = async (req, res) => {
  const { p_contractid, p_rating, p_text } = req.body;

  if (!p_contractid) {
    return res.status(400).json({ status: false, message: "Contract Id Required For Feedback" });
  }

  try {
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

    const feedbackRow = insertFeedback.rows?.[0] || {};
    const p_status = Number(feedbackRow.p_status);
    const p_message = feedbackRow.p_message;

    if (p_status === 1) {
      // SUCCESS
      return res.status(200).json({
        status: true,
        message: p_message,
        source: "db"
      });
    } else if (p_status === 0) {
      return res.status(400).json({
        status: false,
        message: p_message,
        source: "db",
      });
    } else if (p_status === -1) {
      console.error("Stored Procedure Failure:", p_message);
      return res.status(500).json({
        status: p_status,
        message: "Something went wrong. Please try again later.",
      });
    } else {
      return res.status(500).json({
        status: false,
        message: "Unexpected database response",
      });
    }
  } catch (error) {
    console.error("Error in vendorInsertFeedback:", error);
    return res.status(500).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};
