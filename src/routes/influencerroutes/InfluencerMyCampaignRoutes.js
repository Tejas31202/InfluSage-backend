import express from 'express';
import {
    getClientsList,
    getInfluencerMyContract,
    getInfluencerMyCampaignDetails,
    getInfluencerMyCampaignStatus
} from '../../controller/influencercontroller/InfluencerMycampaignController.js';
import authenticateUser from '../../middleware/AuthMiddleware.js';

const routes = express.Router();

routes.get("/client-list", authenticateUser(["Influencer"]), getClientsList);

routes.get(
  "/influencer-contract",
  authenticateUser(["Influencer"]),
  getInfluencerMyContract
);

routes.get(
  "/influencer-campaign/:p_campaignid",
  authenticateUser(["Influencer"]),
  getInfluencerMyCampaignDetails
);

routes.get(
  "/influencer-campaign-status",
  authenticateUser(["Influencer"]),
  getInfluencerMyCampaignStatus
);

export default routes;