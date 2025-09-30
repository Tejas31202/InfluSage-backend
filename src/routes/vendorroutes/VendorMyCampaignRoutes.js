import express from 'express';
import {
    getCampaignStatus,
    getMyAllCampaign,
    getSingleCampaign,
    getCancleReasonList,
    insertCampiginCancleApplication,
    pausedCampaignApplication
} from '../../controller/vendorcontroller/VendorMyCampaignController.js';
import authenticateUser from '../../middleware/AuthMiddleware.js';


const routes = express.Router();


routes.get('/campaignstatus',getCampaignStatus);

routes.get("/reason-list",getCancleReasonList);

routes.post("/pause-campaign/:p_campaignid",authenticateUser(["Vendor"]),pausedCampaignApplication);

routes.post("/cancle-campaign",authenticateUser(["Vendor"]),insertCampiginCancleApplication);

routes.get('/allcampaign',authenticateUser(["Vendor"]),getMyAllCampaign);

routes.get('/singlecampaign/:p_campaignid',authenticateUser(["Vendor"]), getSingleCampaign);

export default routes;