import express from 'express'

const routes = express.Router();

// Import Form Campaign Controller
import {
    GetAllCampaign,
    GetCampaignDetails,
    ApplyNowCampaign,
    AppliedCampaign,
    SaveCampaign,
    GetSaveCampaign

} from '../../controller/influencercontroller/InfluencerCampaignController.js'



//Routes For Campaign
routes.get("/browse", GetAllCampaign);

routes.get("/browse/campaign/:campaignId", GetCampaignDetails);

routes.post('/apply/:campaignId', ApplyNowCampaign);

routes.get('/applied', AppliedCampaign);

routes.post('/saved/campaign', SaveCampaign);

routes.get('/saved/campaign/:userId',GetSaveCampaign)

export default routes;