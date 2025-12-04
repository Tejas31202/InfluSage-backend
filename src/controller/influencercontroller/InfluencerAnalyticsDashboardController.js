import { client } from '../../config/Db.js';


//API	Purpose	Data Size
//getInfluencerAnalyticsSummary()	Top cards — totals	1 record
//getInfluencerEarningSummary()	Earnings chart — breakdown	many records


//getInfluencerSocialStats()
// Returns all social platform stats
// Supports charts & analytics
// Works directly with your API




// Influencer Dashboard → "Content Insights"
// Analytics page → list view
// Sorting/filtering by reel/video/story
// Opening individual content performance modal

export const getInfluencerAnalyticsSummary = async (req, res) => {

    // Total Earnings
    // Completed Campaigns
    // Proposal Sent
    // Total Followers
    // Total Content
    // Avg Engagement Rate

    const p_userid = req.user?.id || req.query.p_userid;

    if (!p_userid) return res.status(400).json({ Message: "Influencer Id Required For Get Summary" });

    try {
        const result = await client.query(
            `select * from ins.getInfluencerAnalyticsSummary($1::bigint);`,
            [p_userid]
        );
        //this function return conunts:-views, likes, Comments, etc
        const influencerAnalyticsSummary = result.rows[0];
        return res.status(200).json({
            message: "Analytics summary retrieved successfully",
            data: influencerAnalyticsSummary,
        });
    } catch (error) {
        console.error("error in InfluencerAnalyticsSummary:", error);
        return res.status(500).json({
            message: error.message,
        });
    }
}

export const getInfluencerEarningSummary = async (req, res) => {

    // Charts and detailed analytics
    // Returns:
    // Monthly earning breakdown
    // Yearly earning breakdown
    // Campaign-wise earning count
    // Trend analysis

    //getInfluencerEarningSummary() returns multiple rows

    //(Monthly, campaign-wise earnings)

    const p_userid = req.user?.id;

    if (!p_userid) {
        return res.status(400).json({
            status: false,
            message: "Influencer Id Required For Earnings Summary"
        });
    }

    try {
        const result = await client.query(
            `SELECT * FROM ins.getInfluencerEarningSummary($1::BIGINT);`,
            [p_userid]
        );

        const InfluencerEarningsSummary = result.rows;

        return res.status(200).json({
            status: true,
            message: "Earning Summary Retrieved Successfully",
            data: InfluencerEarningsSummary
        });

    } catch (error) {
        console.error("Error In InfluencerEarningSummary:", error);

        return res.status(500).json({
            status: false,
            message: "Internal Server Error",
            error: error.message
        });
    }
};

export const getInfluencerSocialStats = async (req, res) => {

    // Returns all social platform stats
    // Supports charts & analytics
    const p_userid = req.user?.id;

    if (!p_userid) return res.status(400).json({ Message: "Influencer Id Required For Get Socials Stats" })

    try {
        const result = await client.query(
            `Select * From ins.influencersocialstats($1::BIGINT)`, [p_userid]
        );
        const socialstats = result.rows;

        return res.status(200).json({
            Message: "Sucessfully Get Social Stats",
            Data: socialstats
        })
    }
    catch (error) {
        console.error("Error In InfluencerEarningSummary:", error);

        return res.status(500).json({
            status: false,
            message: "Internal Server Error",
            error: error.message
        });
    }
}

export const getInfluencerContentTypeStats = async (req, res) => {
    const p_userid = req.user?.id;

    if (!p_userid) {
        return res.status(400).json({
            status: false,
            message: "Influencer Id Required For Content Type Stats"
        });
    }

    try {
        const result = await client.query(
            `SELECT * FROM ins.getInfluencerContentTypeStats($1::BIGINT);`,
            [p_userid]
        );

        const contentTypeStats = result.rows;

        return res.status(200).json({
            status: true,
            message: "Content Type Stats Retrieved Successfully",
            data:contentTypeStats
        });

    } catch (error) {
        console.error("Error in getInfluencerContentTypeStats:", error);
        return res.status(500).json({
            status: false,
            message: "Internal Server Error",
            error: error.message
        });
    }
};

export const getInfluencerContentInsight = async (req, res) => {
    const p_userid = req.user?.id;

    if (!p_userid) {
        return res.status(400).json({
            status: false,
            message: "Influencer Id Required For Content Insight"
        });
    }

    try {
        const result = await client.query(
            `SELECT * FROM ins.getInfluencerContentInsight($1::BIGINT);`,
            [p_userid]
        );

        return res.status(200).json({
            status: true,
            message: "Content Insight Retrieved Successfully",
            data: result.rows
        });

    } catch (error) {
        console.error("Error in getInfluencerContentInsight:", error);
        return res.status(500).json({
            status: false,
            message: "Internal Server Error",
            error: error.message
        });
    }
};












