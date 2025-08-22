import express from 'express'

const routes = express.Router();

//Import Form Campaign Controller
import {
    GetAllCampaign,
    GetCampaignDetails,
    GetFilterPlateform,
    ApplyNowCampaign
    
} from '../../controller/influencercontroller/InfluencerCampaignController.js'

//Routes For Campaign
routes.get("/browse", GetAllCampaign)
routes.get("/browse/Campaign", GetCampaignDetails)
routes.get("/browse/campaign/filter",GetFilterPlateform)
routes.post("/applynow", ApplyNowCampaign)


export default routes;