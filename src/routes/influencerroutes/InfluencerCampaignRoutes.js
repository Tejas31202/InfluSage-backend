import express from 'express'

const routes = express.Router();




// Import Form Campaign Controller
import {
    GetAllCampaign,
    GetCampaignDetails,
    GetFilterPlateform,
    ApplyNowCampaign,
    AppliedCampaign
    
} from '../../controller/influencercontroller/InfluencerCampaignController.js'



//Routes For Campaign

routes.get("/browse", GetAllCampaign);

routes.get("/browse/campaign/filter",GetFilterPlateform);

routes.get("/browse/campaign/:campaignid", GetCampaignDetails);

routes.post('/apply/:campaignid', ApplyNowCampaign);

routes.get('/applied', AppliedCampaign);





export default routes;