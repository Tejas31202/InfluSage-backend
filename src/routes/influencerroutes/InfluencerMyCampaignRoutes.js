import express from 'express';
import {
    getClientsList,
    getInfluencerMyContract,
    getInfluencerMyCampaignDetails,
    getInfluencerMyCampaignStatus,
    getInfluencerMyContractStatus
} from '../../controller/influencercontroller/InfluencerMyCampaignController.js';
import authenticateUser from '../../middleware/AuthMiddleware.js';

const routes = express.Router();

routes.get("/client-list", authenticateUser(["Influencer"]), getClientsList);

routes.get("/contract/status",authenticateUser(["Influencer"]),getInfluencerMyContractStatus);

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