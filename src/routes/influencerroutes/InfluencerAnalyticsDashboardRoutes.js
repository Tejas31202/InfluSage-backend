import express from 'express';
import {
    getInfluencerAnalyticsSummary,
    getInfluencerEarningSummary,
    getInfluencerSocialStats,
    getInfluencerContentTypeStats,
    getInfluencerContentInsight
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


export default routes;