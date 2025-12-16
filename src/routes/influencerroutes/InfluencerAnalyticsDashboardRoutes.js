import express from 'express';
import {
    getInfluencerAnalyticsSummary,
    getInfluencerEarningSummary,
    getInfluencerSocialStats,
    getInfluencerContentTypeStats,
    getInfluencerContentInsight,
    getInfluencerTopPerformingContent,
    getInfluencerPerformanceOvertime,
    getInfluencerAnalyticsPlatformBreakdown,
    getInfluencerEngagementScore,
    getInfluencerImpressionInsight
} from '../../controller/influencercontroller/InfluencerAnalyticsDashboardController.js';
import authenticateUser from '../../middleware/AuthMiddleware.js';

const routes = express.Router();

routes.get("/analytics/summary",
    authenticateUser(["Influencer"]),
    getInfluencerAnalyticsSummary
);

routes.get("/analytics/earningsummary",
    authenticateUser(["Influencer"]),
    getInfluencerEarningSummary
);

routes.get(
    "/analytics/social",
    authenticateUser(["Influencer"]),
    getInfluencerSocialStats
);

routes.get(
  "/analytics/content-type",
  authenticateUser(["Influencer"]),
  getInfluencerContentTypeStats
);

routes.get(
    "/analytics/content-insight",
    authenticateUser(["Influencer"]),
    getInfluencerContentInsight
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
    "/analytics/impression",
    authenticateUser(["Influencer"]),
    getInfluencerImpressionInsight
);

export default routes;