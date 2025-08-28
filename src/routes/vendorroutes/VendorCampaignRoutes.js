import express from 'express';
import {
  createMyCampaign, getCampaign, deleteCampaignFile, finalizeCampaign} from '../../controller/vendorcontroller/VendorCampaignController.js';
import authenticateUser from "../../middleware/AuthMiddleware.js";
import {upload} from "../../middleware/CampaignMulterMiddleware.js"

const routes = express.Router();
// Step 1-5 → draft or auto-final if all parts present
routes.post('/create-campaign', upload.array("Files", 5), authenticateUser(['Vendor']), createMyCampaign);

// Step 6 → Finalize Campaign button
routes.post('/finalize-campaign', authenticateUser(['Vendor']), finalizeCampaign);


routes.get("/campaign/:campaignId", authenticateUser(["Vendor"]), getCampaign);

routes.post(
  "/campaign/delete-file",
  authenticateUser(["Vendor"]), // optional role check
  deleteCampaignFile
);



export default routes;