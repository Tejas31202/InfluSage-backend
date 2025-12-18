import { client } from "../../config/Db.js";

export const getInfluencerAnalyticsSummary = async (req, res) => {
    try {
        const p_userid = req.user?.id || req.query.p_userid;
        if (!p_userid) {
            return res.status(400).json({ Message: "p_userid is required." });
        }
        const result = await client.query(
            `select * from ins.fn_get_influenceranalytic($1::bigint);`,
            [p_userid]
        );
        const influencerAnalyticsSummary = result.rows[0].fn_get_influenceranalytic;
        return res.status(200).json({
            message: "Influencer Analytics summary retrieved successfully",
            data: influencerAnalyticsSummary,
        });
    } catch (error) {
        console.error("error in InfluencerAnalyticsSummary:", error);
        return res.status(500).json({
            message: error.message,
        });
    }
};

export const getInfluencerImpressionInsight = async (req, res) => {
    try {
        const p_userid = req.user?.id || req.query.p_userid;
        const { p_filtertype } = req.query;
        if (!p_userid) {
            return res.status(400).json({
                message: "p_userid is Required.",
            });
        }
        const result = await client.query(
            ` select * from  ins.fn_get_influencerestimatedimpression($1::bigint,$2::varchar);`,
            [p_userid, p_filtertype || "year"]
        );
        const data = result.rows[0].fn_get_influencerestimatedimpression;
        return res.status(200).json({
            message: "Influencer Estimated Impression Retrieved Successfully",
            data: data,
        });
    } catch (error) {
        console.error("Error In getInfluencerImpressionInsight:", error);
        return res.status(500).json({
            message: "Something went wrong.",
            error: error.message,
        });
    }
};

export const getInfluencerTopPerformingContent = async (req, res) => {
    try {
        const p_userid = req.user?.id || req.query.p_userid;
        if (!p_userid) {
            return res.status(400).json({ Message: "p_userid is Required." });
        }
        const { p_filtertype } = req.query;
        if (!p_filtertype) {
            return res.status(400).json({ Message: "p_filtertype is Required." });
        }
        const topPerformingContent = await client.query(
            `select * from ins.fn_get_influencertopperformingcontent($1::bigint,$2::varchar)`,
            [p_userid, p_filtertype]
        );
        const topPerContentRes = topPerformingContent.rows[0].fn_get_influencertopperformingcontent;
        return res.status(200).json({
            Message: "Influencer Top Performing Retrieved Content Successfully.",
            data: topPerContentRes,
        });
    } catch (error) {
        console.error("error in getInfluencerTopPerformingContent:", error);
        return res.status(500).json({
            message: error.message,
        });
    }
};

export const getInfluencerPerformanceOvertime = async (req, res) => {
    try {
        const p_userid = req.user?.id || req.query.p_userid;
        if (!p_userid) {
            return res.status(400).json({ Message: "p_userid Required" });
        }
        const { p_filtertype } = req.query;

        if (!p_filtertype) {
            return res.status(400).json({ Message: "p_filtertype is Required." });
        }
        const performanceOverTime = await client.query(
            ` select * from ins.fn_get_influencerperformanceovertime($1::bigint,$2::varchar)`,
            [p_userid, p_filtertype]
        );
        const performanceOvertimeRes = performanceOverTime.rows[0].fn_get_influencerperformanceovertime;
        return res.status(200).json({
            Message: "Influencer Performance Over Time Retrieved Successfully.",
            data: performanceOvertimeRes,
        });
    } catch (error) {
        console.error("error in getInfluencerPerformanceOvertime:", error);
        return res.status(500).json({
            message: error.message,
        });
    }
};

export const getInfluencerAnalyticsPlatformBreakdown = async (req, res) => {
    try {
        const p_userid = req.user?.id || req.query.p_userid;
        if (!p_userid)
            return res.status(400).json({ Message: "p_userid is required." });
        const { p_year, p_month } = req.query;
        if (!p_year)
            return res.status(400).json({ Message: "p_year is required." });
        const plateFormBreakdown = await client.query(
            `select * from ins.fn_get_influencerplatformbreakdown(
            $1::bigint,
            $2::integer,
            $3::integer 
            )`,
            [p_userid, p_year, p_month || null]
        );
        const breakDownRes = plateFormBreakdown.rows[0].fn_get_influencerplatformbreakdown;
        return res.status(200).json({
            Message: "InfluencerAnalyticsPlateForm Fetched Sucessfully",
            data: breakDownRes,
        });
    } catch (error) {
        console.error("Error In getInfluencerCampaign Top Performing Content ", error);
        return res.status(500).json({
            message: "Something went wrong.",
            error: error.message,
        });
    }
};

export const getInfluencerEngagementScore = async (req, res) => {
    try {
        const p_userid = req.user?.id || req.query.p_userid;
        const { p_filtertype } = req.query;
        if (!p_userid) {
            return res.status(400).json({
                message: "p_userid is Required.",
            });
        }
        const result = await client.query(
            ` SELECT ins.fn_get_influencerengagementscore($1::bigint,$2::varchar(15));`,
            [p_userid, p_filtertype || "year"]
        );
        const data = result.rows[0].fn_get_influencerengagementscore[0];
        return res.status(200).json({
            message: "Engagement Score Retrieved Successfully",
            data: data,
        });
    } catch (error) {
        console.error("Error In getInfluencerEngagementScore:", error);
        return res.status(500).json({
            message: "Something went wrong while fetching engagement score.",
            error: error.message,
        });
    }
};

export const getInfluencerCampaignList = async (req, res) => {
    try {
        const p_userid = req.user?.id || req.query.p_userid;
        if (!p_userid) {
            return res.status(400).json({
                message: "p_userid is Required.",
            });
        }
        const result = await client.query(
            `select * from ins.fn_get_influencercampaignlist($1::bigint);`,
            [p_userid]
        );
        const data = result.rows[0].fn_get_influencercampaignlist || [];
        return res.status(200).json({
            message: "Campaign List Retrieved Successfully",
            data: data,
            source: "db"
        });
    } catch (error) {
        console.error("Error In getInfluencerCampaignList:", error);
        return res.status(500).json({
            message: "Something went wrong.",
            error: error.message,
        });
    }
};

export const getInfluencerCampaignInsight = async (req, res) => {
    const p_userid = req.user?.id || req.query.p_userid;
    const p_campaignid = req.query.p_campaignid;
    if (!p_userid || !p_campaignid) { return res.status(400).json({ Message: "User Id And Campaign Id Required For Get Campaign Insight" }) };
    try {
        const campaignInsight = await client.query(`
            select * from ins.fn_get_influencercampaigninsight($1::BIGINT,$2::BIGINT)`,
            [p_userid, p_campaignid]);
        const campaignInsightRes = campaignInsight.rows[0].fn_get_influencercampaigninsight || [];
        return res.status(200).json({
            Message: "Campaign insight Get Sucessfully",
            data: campaignInsightRes,
            source: "db"
        })
    } catch (error) {
        console.error("Error In getInfluencerCampaignInsight:", error);
        return res.status(500).json({
            message: "Something went wrong.",
            error: error.message,
        });
    }
}

export const getInfluencerCampaignPerformanceOvertime = async (req, res) => {
    const p_userid = req.user?.id || req.query.p_userid;
    const p_campaignid = req.query.p_campaignid;
    if (!p_userid || !p_campaignid) { return res.status(400).json({ Message: "User Id And Campaign Required For Get Campaign Performance OverTime" }) };
    const { p_filtertype } = req.query;
    try {
        const performanceOvertime = await client.query(`
            select * from ins.fn_get_influencercampaignperformanceovertime($1::bigint,$2::bigint,$3::varchar)`,
            [
                p_userid,
                p_campaignid,
                p_filtertype || 'year'
            ]
        );
        const campaignOvertimeRes = performanceOvertime.rows[0].fn_get_influencercampaignperformanceovertime;
        return res.status(200).json({
            Message: "Campaign Performance Overtime Get Seccuessfully",
            data: campaignOvertimeRes,
            source: "db"
        });
    } catch (error) {
        console.error("Error In getInfluencerCampaignInsight:", error);
        return res.status(500).json({
            message: "Something went wrong.",
            error: error.message,
        });
    }
}

export const getInfluencerCampaignEngagementScore = async (req, res) => {
    const p_userid = req.user?.id || req.query.p_userid;
    const p_campaignid = req.query.p_campaignid;
    if (!p_userid || !p_campaignid) { return res.status(400).json({ Message: "User Id And Campaign Id Required For Campaign Engagement Score." }) };
    const { p_filtertype } = req.query;
    try {
        const campaignEngagementScore = await client.query(`
            select * from ins.fn_get_influencercampaignengagementscore($1::bigint,$2::bigint,$3::varchar)`,
            [
                p_userid,
                p_campaignid,
                p_filtertype || 'year'
            ]
        );
        const campaignEngagementScoreRes = campaignEngagementScore.rows[0].fn_get_influencercampaignengagementscore[0] || [];
        return res.status(200).json({
            Message: "Campaign Engagement  Score Sucessfully Get",
            data: campaignEngagementScoreRes,
            source: "db"
        })
    }
    catch (error) {
        console.error("Error In getInfluencerCampaign Engagement Score:", error);
        return res.status(500).json({
            message: "Something went wrong.",
            error: error.message,
        });

    }

}

export const getInfluencerCampaignTopPerformingContent = async (req, res) => {
    console.log("Function calling")
    const p_userid = req.user?.id || req.query.p_userid;
    const p_campaignid = req.query.p_campaignid;
    if (!p_userid || !p_campaignid) { return res.status(400).json({ Message: "User Id And Campaign Id Required For Get Campaign Top Performing Content" }) };
    const { p_filtertype } = req.query;
    try {
        const campaignTopPerformingContent = await client.query(`
            select * from ins.fn_get_influencercampaigntopperformingcontent($1::bigint,$2::bigint,$3::varchar)`,
            [
                p_userid,
                p_campaignid,
                p_filtertype || 'year'
            ]);
        const campaignTopPerformingContentRes = campaignTopPerformingContent.rows[0].fn_get_influencercampaigntopperformingcontent;
        return res.status(200).json({
            Message: "Top Performing Content Sucessfully Get",
            data: campaignTopPerformingContentRes,
            source: "db"
        })
    }
    catch (error) {
        console.error("Error In getInfluencerCampaign Top Performing Content ", error);
        return res.status(500).json({
            message: "Something went wrong.",
            error: error.message,
        });
    }
}

export const getInfluencerCampaignContribution = async (req, res) => {
    const p_userid = req.user?.id || req.query.p_userid;
    if (!p_userid) return res.status(400).json({ Message: "User Id Required For Get Campaign Contribution" });
    const { p_filtertype } = req.query;
    try {
        const campaignContribution = await client.query(`
            select * from ins.fn_get_influencercampaigncontribution($1::bigint,$2::varchar)`,
            [
                p_userid,
                p_filtertype || 'year'
            ]);
        const campaignContributionRes = campaignContribution.rows[0].fn_get_influencercampaigncontribution;
        return res.status(200).json({
            Message: "Campaign Contribution Get Sucessfully",
            data: campaignContributionRes,
            source: "db"
        });
    }
    catch (error) {
        console.error("Error In getInfluencerCampaign Contribution ", error);
        return res.status(500).json({
            message: "Something went wrong.",
            error: error.message,
        });
    }

}

export const getRecentContents = async (req, res) => {
    const p_userid = req.user?.id || req.query.p_userid;
    if (!p_userid) return res.status(400).json({ Message: "User id Required For Recent Contents" });
    try {
        const recentContents = await client.query(`
            select * from ins.fn_get_influenceranalytic($1::bigint)`,
            [p_userid]
        );
        const recentContentsRes = recentContents.rows[0].fn_get_influenceranalytic || [];
        return res.status(200).json({
            Message: "Recent Contents Get Sucessfully",
            data: recentContentsRes.recentcontents,
            source: "db"
        })
    } catch (error) {
        console.error("Error In getInfluencer Recent Content ", error);
        return res.status(500).json({
            message: "Something went wrong.",
            error: error.message,
        });

    }
}

