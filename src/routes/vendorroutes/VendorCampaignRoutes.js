import express from 'express';
import {
  createMyCampaign, getCampaign} from '../../controller/vendorcontroller/VendorCampaignController.js';
import authenticateUser from "../../middleware/AuthMiddleware.js";
import {upload} from "../../middleware/CampaignMulterMiddleware.js"
const routes = express.Router();
routes.post(
  "/create-campaign",
  authenticateUser(["Vendor"]),
  upload.array("campaignFiles", 5),  
  createMyCampaign
);

routes.get("/campaign/:campaignId", authenticateUser(["Vendor"]), getCampaign);
export default routes;