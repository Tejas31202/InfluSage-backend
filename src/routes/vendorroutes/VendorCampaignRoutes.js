import express from 'express';
import {
  createMyCampaign, getCampaign, deleteCampaignFile} from '../../controller/vendorcontroller/VendorCampaignController.js';
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

routes.post(
  "/campaign/delete-file",
  authenticateUser(["Vendor"]), // optional role check
  deleteCampaignFile
);
export default routes;