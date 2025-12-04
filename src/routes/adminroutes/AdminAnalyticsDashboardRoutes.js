import express from 'express';
const routes = express.Router();
import {
  getAdminAnalyticsNewContents,
  getUpdatedAnalyticsContents,
  getAllContentHistories,
  getInfluencerContentHistory,
  insertAnalyticsRecord
} from '../../controller/admincontroller/AdminAnalyticsDashboardController.js';
import authenticateUser from '../../middleware/AuthMiddleware.js';

routes.get(
  "/analytics/new-contents",
  authenticateUser(["Admin"]),
  getAdminAnalyticsNewContents
);

routes.get(
  "/analytics/updated-contents",
  authenticateUser(["Admin"]),
  getUpdatedAnalyticsContents
);

routes.get(
  "/analytics/contents-histories",
  authenticateUser(["Admin"]),
  getAllContentHistories
);

routes.get(
  "/analytics/content-history/:p_influencerid",
  authenticateUser(["Admin"]),
  getInfluencerContentHistory
);

routes.post(
  "/analytics/insert-analytics",
  authenticateUser(["Admin"]),
  insertAnalyticsRecord
);

export default routes;
