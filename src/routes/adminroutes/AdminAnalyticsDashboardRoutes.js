import express from 'express';
const routes = express.Router();
import {
  getAdminAnalyticsNewContents,
  getStatusFilterForAnalytics,
  getAllContentHistories,
  getInfluencerContentHistory,
  insertAnalyticsRecord,
  getLastInsertAnlyticsData,
  getUpdatedContentsAnalyticList
} from '../../controller/admincontroller/AdminAnalyticsDashboardController.js';
import authenticateUser from '../../middleware/AuthMiddleware.js';

routes.get(
  "/analytics/status-filters",
  getStatusFilterForAnalytics
);

routes.get(
  "/analytics/new-contents",
  authenticateUser(["Admin"]),
  getAdminAnalyticsNewContents
);

routes.get(
  "/analytics/contents-histories",
  authenticateUser(["Admin"]),
  getAllContentHistories
);

routes.get(
  "/analytics/content-history/:p_contractcontentlinkid",
  authenticateUser(["Admin"]),
  getInfluencerContentHistory
);

routes.post(
  "/analytics/data/insert-edit",
  authenticateUser(["Admin"]),
  insertAnalyticsRecord
);

routes.get(
  "/user-Platform-Analytics",
  authenticateUser(["Admin"]),
  getLastInsertAnlyticsData
);

routes.get(
  "/getAnalyticList",
  authenticateUser(["Admin"]),
  getUpdatedContentsAnalyticList
);

export default routes;
