import express from 'express';
const routes = express.Router();
import {
  getAdminAnalyticsNewContents,
  getUpdatedAnalyticsContents,
  getAllContentHistories,
  getInfluencerContentHistory,
  insertOrEditAnalyticsRecord,
  getUserPlatformAnalytics,
  getAnalyticList
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
  "/analytics/data/insert-edit",
  authenticateUser(["Admin"]),
  insertOrEditAnalyticsRecord
);

routes.get(
  "/user-Platform-Analytics",
  authenticateUser(["Admin"]),
  getUserPlatformAnalytics
)

routes.get(
  "/getAnalyticList",
  authenticateUser(["Admin"]),
  getAnalyticList
)

export default routes;
