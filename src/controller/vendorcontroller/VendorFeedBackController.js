import { client } from '../../config/Db.js';


export const vendorInsertFeedback = async (req, res) => {

    const { p_campaignid, influencerid, p_rating, p_text } = req.body;
    if (!p_campaignid || !influencerid) {
        return res.status(400).json({
            status: false,
            message: "campaignId and influencerId are required."
        });
    }

    try {
        const insertFeedback = await client.query(`
            CALL ins.usp_insert_feedback (
            $1::BIGINT,
            $2::BIGINT,
            $3::SMALLINT,
            $4::TEXT,
            $5::boolean,
            $6::TEXT
            )`,
            [
                p_campaignid,
                influencerid,
                p_rating,
                p_text,
                null,
                null
            ])

        const { p_status, p_message } = insertFeedback.rows?.[0] || {};

        const feedbackResult = insertFeedback.rows?.[0] || {};
        return res.status(200).json({
            Message: p_message || "Feedback submitted successfully",
            Status: p_status,
            data: feedbackResult
        })

    } catch (error) {
        console.error("Error in Inserting FeedBack", error);
        return res.status(500).json(
            {
                Message: "Internal Server Error"
            }
        )
    }
}

