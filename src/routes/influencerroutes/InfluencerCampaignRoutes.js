import express from 'express';
import {
  getCampaignDetails,
  applyNowCampaign,
  getUsersAppliedCampaigns,
  saveCampaign,
  getSaveCampaign,
  getSingleApplyCampaign,
  getUserCampaignWithDetails,
  withdrawApplication,
  browseCampaigns,
  deleteApplyNowPortfolioFile,
  getFeedbackList,
  getCampaignApplicationStatus
} from '../../controller/influencercontroller/InfluencerCampaignController.js';
import authenticateUser from '../../middleware/AuthMiddleware.js';
import { upload } from '../../middleware/MulterMiddleware.js';

const routes = express.Router();

routes.get(
  "/campaign-details/:campaignId",
  authenticateUser(["Influencer"]),
  getCampaignDetails
);

routes.post(
  "/apply-for-campaign/:campaignId",
  authenticateUser(["Influencer"]),
  upload.fields([{ name: "portfolioFiles", maxCount: 5 }]),
  applyNowCampaign
);

routes.get(
  "/applied-campaigns",
  authenticateUser(["Influencer"]),
  getUsersAppliedCampaigns
);

routes.get(
  "/signle-applied/:campaignId",
  authenticateUser(["Influencer"]),
  getSingleApplyCampaign
);

routes.get(
  "/browse-all-campaigns/fiterWithSort",
  authenticateUser(["Influencer"]),
  browseCampaigns
);

routes.post(
  "/withdraw-application",
  authenticateUser(["Influencer"]),
  withdrawApplication
);

routes.post(
  "/save-campaign/:campaignId",
  authenticateUser(["Influencer"]),
  saveCampaign
);

routes.get(
  "/saved-campaign",
  authenticateUser(["Influencer"]),
  getSaveCampaign
);

routes.get(
  "/applied-campaign-details/:campaignId",
  authenticateUser(["Influencer"]),
  getUserCampaignWithDetails
);

routes.post(
  "/apply-now/portfoliofile-delete",
  authenticateUser(["Influencer"]),
  deleteApplyNowPortfolioFile
);
routes.get(
  "/vendor-feedback-list",
  authenticateUser(["Influencer"]),
  getFeedbackList
)

routes.get(
  "/Campaign-ApplicationStatus",
  authenticateUser(["Influencer"]),
  getCampaignApplicationStatus
)

export default routes;
