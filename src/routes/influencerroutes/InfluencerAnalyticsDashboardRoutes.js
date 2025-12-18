import express from 'express';
import {
    getInfluencerAnalyticsSummary,
    getInfluencerImpressionInsight,
    getInfluencerTopPerformingContent,
    getInfluencerPerformanceOvertime,
    getInfluencerAnalyticsPlatformBreakdown,
    getInfluencerEngagementScore,
    getInfluencerCampaignList,
    getInfluencerCampaignInsight,
    getInfluencerCampaignPerformanceOvertime,
    getInfluencerCampaignEngagementScore,
    getInfluencerCampaignTopPerformingContent,
    getInfluencerCampaignContribution,
    getInfluencerRecentContents
} from '../../controller/influencercontroller/InfluencerAnalyticsDashboardController.js';
import authenticateUser from '../../middleware/AuthMiddleware.js';

const routes = express.Router();

routes.get("/analytics/summary",
    authenticateUser(["Influencer"]),
    getInfluencerAnalyticsSummary
);

routes.get(
    "/analytics/impression",
    authenticateUser(["Influencer"]),
    getInfluencerImpressionInsight
);

routes.get(
    "/analytics/top-performing-content",
    authenticateUser(["Influencer"]),
    getInfluencerTopPerformingContent
);

routes.get(
    "/analytics/performance-overtime",
    authenticateUser(["Influencer"]),
    getInfluencerPerformanceOvertime
);

routes.get(
    "/analytics/platform-breakdown",
    authenticateUser(["Influencer"]),
    getInfluencerAnalyticsPlatformBreakdown
);

routes.get(
    "/analytics/engagement-score",
    authenticateUser(["Influencer"]),
    getInfluencerEngagementScore
);

routes.get(
    "/analytics/campaign-list",
    authenticateUser(["Influencer"]),
    getInfluencerCampaignList
);

routes.get(
    "/analytics/campaign-insight",
    authenticateUser(["Influencer"]),
    getInfluencerCampaignInsight
)

routes.get("/analytics/campaign-performanceovertime",
    authenticateUser(["Influencer"]),
    getInfluencerCampaignPerformanceOvertime
)

routes.get("/analytics/campaign-engagementscore",
    authenticateUser(["Influencer"]),
    getInfluencerCampaignEngagementScore
)

routes.get("/analytics/campaign-topperformingcontent",
    authenticateUser(["Influencer"]),
    getInfluencerCampaignTopPerformingContent
)

routes.get("/analytics/campaign-Contribution",
    authenticateUser(["Influencer"]),
    getInfluencerCampaignContribution
)

routes.get("/analytics/campaign-recents",
    authenticateUser(["Influencer"]),
    getInfluencerRecentContents
)


export default routes;