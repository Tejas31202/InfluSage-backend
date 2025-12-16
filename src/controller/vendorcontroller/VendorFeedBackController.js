import { client } from '../../config/Db.js';


export const vendorInsertFeedback = async (req, res) => {
    const userId = req.user?.id || req.body.userId;

    if (!userId) {
        return res.status(401).json({
            status: false,
            message: "Unauthorized: user not found",
        });
    }

    const { p_campaignid, influencerid, p_rating, p_text } = req.body;
    if (!p_campaignid || !influencerid) {
        return res.status(400).json({
            status: false,
            message: "campaignId and influencerId are required."
        });
    }

    try {
        await client.query("BEGIN");
        await client.query(
            "SELECT set_config('app.current_user_id', $1, true)",
            [String(userId)]
        );
        const insertFeedback = await client.query(`
            CALL ins.usp_insert_feedback (
            $1::BIGINT,
            $2::BIGINT,
            $3::SMALLINT,
            $4::TEXT,
            $5::smallint,
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
        await client.query("COMMIT");

        const feedbackRow = insertFeedback.rows?.[0] || {};
        const p_status = Number(feedbackRow.p_status);
        const p_message = feedbackRow.p_message;

        // -------------------------------
        //  HANDLE p_status
        // -------------------------------
        if (p_status === 1) {
            // SUCCESS
            return res.status(200).json({
                status: true,
                message: p_message || "Feedback submitted successfully",
                data: feedbackRow
            });
        } else if (p_status === 0) {
            // VALIDATION FAIL
            return res.status(400).json({
                status: false,
                message: p_message || "Validation failed",
                data: feedbackRow
            });
        } else if (p_status === -1) {
            console.error("Stored Procedure Failure:", p_message);
            // PROCEDURE FAILED
            return res.status(500).json({
                status: false,
                message: "Something went wrong. Please try again later.",
                data: feedbackRow
            });
        } else {
            // UNEXPECTED
            return res.status(500).json({
                status: false,
                message: "Unexpected database response",
                data: feedbackRow
            });
        }


    } catch (error) {
        console.error("Error in Inserting FeedBack", error);
        return res.status(500).json(
            {
                Message: "Internal Server Error"
            }
        )
    }
}

