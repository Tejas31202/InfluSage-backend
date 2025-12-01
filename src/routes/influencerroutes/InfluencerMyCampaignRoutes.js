import express from 'express';
import {
    getClientsList,
    getInfluencerMyCampaign,
    getInfluencerMyCampaignDetails,
    getInfluencerMyCampaignStatus
} from '../../controller/influencercontroller/InfluencerMycampaignController.js';
import authenticateUser from '../../middleware/AuthMiddleware.js';

const routes = express.Router();

routes.get('/client-list',authenticateUser(["Influencer"]),getClientsList);
routes.get('/influencer-campaigns',authenticateUser(["Influencer"]),getInfluencerMyCampaign);
routes.get('/influencer-campaign/:p_campaignid',authenticateUser(["Influencer"]),getInfluencerMyCampaignDetails)
routes.get('/influencer-campaign-status',authenticateUser(["Influencer"]),getInfluencerMyCampaignStatus)

export default routes;