import express from 'express'

const routes = express.Router();

// Import Form Campaign Controller
import {
    GetAllCampaign,
    GetCampaignDetails,
    ApplyNowCampaign,
    GetUsersAppliedCampaigns,
    SaveCampaign,
    GetSaveCampaign,
    GetSingleApplyCampaign,
    GetUserCampaignWithDetails
} from '../../controller/influencercontroller/InfluencerCampaignController.js'
import authenticateUser from '../../middleware/AuthMiddleware.js';
import {upload} from "../../middleware/MulterMiddleware.js"



//Routes For Campaign
routes.get("/browse",GetAllCampaign);

routes.get("/browse/campaign/:campaignId", GetCampaignDetails);

routes.post('/apply/:campaignId', authenticateUser(["Influencer"]),upload.fields([
    { name: "portfolioFiles", maxCount: 5}
  ]),ApplyNowCampaign); 

routes.get('/applied/:userId', GetUsersAppliedCampaigns);

routes.get("/apply/:campaignId",authenticateUser(["Influencer"]),GetSingleApplyCampaign)

routes.post('/saved/campaign', SaveCampaign);

routes.get('/saved/campaign/:userId',GetSaveCampaign)

routes.get('/campaign/:campaignId/details',authenticateUser(["Influencer"]),GetUserCampaignWithDetails)

export default routes;