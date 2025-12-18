import express from 'express';
import authenticateUser from '../../middleware/AuthMiddleware.js';

import {
    getVendorCompleteProfilePercentage,
    getVendorPerformanceSummary,
    getTotalVendorCampaigns,
    getCampaignSummary,
    getVendorRecentCampaigns,
    getVendorRecentApplications,
    getVendorPendingContentList
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
  "/dashboard/total-campaigns",
  authenticateUser(["Vendor"]),
  getTotalVendorCampaigns
);

routes.get(
  "/dashboard/campaign-summary",
  authenticateUser(["Vendor"]),
  getCampaignSummary
);

routes.get(
  "/dashboard/recent-campaigns",
  authenticateUser(["Vendor"]),
  getVendorRecentCampaigns
);

routes.get(
  "/dashboard/recent-applications",
  authenticateUser(["Vendor"]),
  getVendorRecentApplications
);

routes.get(
  "/dashboard/pending-content-list",
  authenticateUser(["Vendor"]),
  getVendorPendingContentList
)

export default routes;