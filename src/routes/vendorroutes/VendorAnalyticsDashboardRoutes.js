import express from 'express';
import {
  getVendorAnalyticsSummary,
  getVendorCampaignOverview,
  getPerformanceTimeline,
  getTopPerformingContent,
  getPlatformBreakdown
} from '../../controller/vendorcontroller/VendorAnalyticsDashboardController.js';
import authenticateUser from '../../middleware/AuthMiddleware.js';

const routes = express.Router();

routes.get(
  "/analytics/summary",
  authenticateUser(['Vendor']),
  getVendorAnalyticsSummary
);

routes.get(
  "/analytics/campaign-overview",
  authenticateUser(['Vendor']),
  getVendorCampaignOverview
);

routes.get(
  "/analytics/performance-timeline",
  authenticateUser(['Vendor']),
  getPerformanceTimeline
);

routes.get(
  "/analytics/top-performing-content",
  authenticateUser(['Vendor']),
  getTopPerformingContent
);

routes.get(
  "/analytics/platform-breakdown",
  authenticateUser(['Vendor']),
  getPlatformBreakdown
);


export default routes;
