import express from 'express';
import {
getOffersForCampaign,getViewAllOffersForSingleCampaign
} from '../../controller/vendorcontroller/VendorOffersController.js';
import authenticateUser from '../../middleware/AuthMiddleware.js';

const routes=express.Router();

routes.get("/all-offers",authenticateUser(["Vendor"]),getOffersForCampaign);
routes.get("/view-all-offers/:campaignId",authenticateUser(["Vendor"]),getViewAllOffersForSingleCampaign)

export default routes;