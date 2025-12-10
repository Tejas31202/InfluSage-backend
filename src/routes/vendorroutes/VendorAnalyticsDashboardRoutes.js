import express from 'express';
import {
  getVendorAnalyticsSummary,
  getPerformanceTimeline,
  getGraphFiltersDropdown
} from '../../controller/vendorcontroller/VendorAnalyticsDashboardController.js';
import authenticateUser from '../../middleware/AuthMiddleware.js';

const routes = express.Router();

routes.get("/analytics/dropdowns", getGraphFiltersDropdown);

routes.get(
  "/analytics/summary",
  authenticateUser(['Vendor']),
  getVendorAnalyticsSummary
);


routes.get(
  "/analytics/performance-timeline",
  authenticateUser(['Vendor']),
  getPerformanceTimeline
);

export default routes;
