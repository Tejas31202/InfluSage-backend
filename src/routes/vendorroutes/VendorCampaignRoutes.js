import express from 'express';
import {
  createMyCampaign, getCampaign, deleteCampaignFile, finalizeCampaign,GetCampaignObjectives,GetLanguages} from '../../controller/vendorcontroller/VendorCampaignController.js';
import authenticateUser from "../../middleware/AuthMiddleware.js";
import {upload} from "../../middleware/CampaignMulterMiddleware.js"

const routes = express.Router();
// Step 1-5 → draft or auto-final if all parts present

routes.get("/campaign/objectives",GetCampaignObjectives);
routes.get("/campaign/languages",GetLanguages)

routes.post('/create-campaign',authenticateUser(['Vendor']),upload.array("Files", 5),createMyCampaign);

// Step 6 → Finalize Campaign button
routes.post('/finalize-campaign', authenticateUser(['Vendor']), finalizeCampaign);


routes.get("/campaign/:campaignId", authenticateUser(["Vendor"]), getCampaign);

routes.post(
  "/campaign/delete-file",
  authenticateUser(["Vendor"]), // optional role check
  deleteCampaignFile
);





export default routes;