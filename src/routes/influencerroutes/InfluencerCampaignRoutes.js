import express from 'express';

const routes = express.Router();

import {
  getCampaignDetails,
  applyNowCampaign,
  getUsersAppliedCampaigns,
  saveCampaign,
  getSaveCampaign,
  getSingleApplyCampaign,
  getUserCampaignWithDetails,
  browseCampaigns,
} from '../../controller/influencercontroller/InfluencerCampaignController.js';
import authenticateUser from '../../middleware/AuthMiddleware.js';
import { upload } from '../../middleware/MulterMiddleware.js';

routes.get("/campaign-details/:campaignId", getCampaignDetails);

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

export default routes;
