import express from 'express';
import {
    getClientsList,
    getInfluencerMyCampaign,
    getInfluencerMyCampaignDetails
} from '../../controller/influencercontroller/InfluencerMycampaignController.js';
import authenticateUser from '../../middleware/AuthMiddleware.js';

const routes = express.Router();

routes.get('/clientlist',authenticateUser(["Influencer"]),getClientsList);
routes.get('/influencermycampaign',authenticateUser(["Influencer"]),getInfluencerMyCampaign);
routes.get('/singleinfluencermycampaign',authenticateUser(["Influencer"]),getInfluencerMyCampaignDetails)

export default routes;