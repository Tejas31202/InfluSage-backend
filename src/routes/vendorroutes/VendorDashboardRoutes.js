import express from 'express';
import authenticateUser from '../../middleware/AuthMiddleware.js';

import {
    getVendorCompleteProfilePercentage,
    getVendorPerformanceSummary,
    getVendorPendingContentList,
    getVendorCampaignStatusOverview
} from '../../controller/vendorcontroller/VendorDashboardController.js';

const routes = express.Router();

routes.get(
  "/dashboard/profile-completion-perctange",
  authenticateUser(["Vendor"]),
  getVendorCompleteProfilePercentage
);

routes.get(
  "/dashboard/performancesummary",
  authenticateUser(["Vendor"]),
  getVendorPerformanceSummary
);

routes.get(
  "/dashboard/pending-content-list",
  authenticateUser(["Vendor"]),
  getVendorPendingContentList
)

routes.get(
  "/dashboard/campaign-status-overview",
  authenticateUser(["Vendor"]),
  getVendorCampaignStatusOverview
)
export default routes;