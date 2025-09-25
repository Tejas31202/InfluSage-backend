import express from 'express';
import {
    getCampaignStatus,
    getMyAllCampaign,
    getSingleCampaign,
    
} from '../../controller/vendorcontroller/VendorMyCampaignController.js';
import authenticateUser from '../../middleware/AuthMiddleware.js';


const routes = express.Router();


routes.get('/campaignstatus',getCampaignStatus);

routes.get('/allcampaign',authenticateUser(["Vendor"]),getMyAllCampaign);

routes.get('/singlecampaign',getSingleCampaign)

export default routes;