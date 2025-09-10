import express from 'express'

const routes = express.Router();

// Import Form Campaign Controller
import {
  // GetAllCampaign,
  GetCampaignDetails,
  ApplyNowCampaign,
  GetUsersAppliedCampaigns,
  SaveCampaign,
  GetSaveCampaign,
  GetSingleApplyCampaign,
  GetUserCampaignWithDetails,
  browseCampaigns
} from '../../controller/influencercontroller/InfluencerCampaignController.js'
import authenticateUser from '../../middleware/AuthMiddleware.js';
import { upload } from "../../middleware/MulterMiddleware.js"



//Routes For Campaign
// routes.get("/browse",authenticateUser(), GetAllCampaign);

routes.get("/campaign-details/:campaignId", GetCampaignDetails);

routes.post('/apply-for-campaign/:campaignId', authenticateUser(["Influencer"]), upload.fields([
  { name: "portfolioFiles", maxCount: 5 }
]), ApplyNowCampaign);

routes.get('/applied-campaigns', authenticateUser(["Influencer"]), GetUsersAppliedCampaigns);

routes.get("/signle-applied/:campaignId", authenticateUser(["Influencer"]), GetSingleApplyCampaign)

routes.get('/browse-all-campaigns/fiterWithSort', authenticateUser(["Influencer"]), browseCampaigns);

routes.post('/save-campaign/:campaignId', authenticateUser(["Influencer"]), SaveCampaign);

routes.get('/saved-campaign', authenticateUser(["Influencer"]), GetSaveCampaign)

routes.get('/applied-campaign-details/:campaignId', authenticateUser(["Influencer"]), GetUserCampaignWithDetails)

export default routes;