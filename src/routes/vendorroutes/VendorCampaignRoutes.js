import express from 'express';
import {
  createMyCampaign,
  getCampaign,
  deleteCampaignFile,
  finalizeCampaign,
  getCampaignObjectives,
  getInfluencerTiers,
  getProvidorContentTypes,
  editCampaign,
  upsertCampaign
} from '../../controller/vendorcontroller/VendorCampaignController.js';
import authenticateUser from '../../middleware/AuthMiddleware.js';
import { upload } from '../../middleware/CampaignMulterMiddleware.js';


const routes = express.Router();

routes.get("/campaign/objectives", getCampaignObjectives);

routes.get("/influencer-type", getInfluencerTiers);

routes.get("/provider-content-type", getProvidorContentTypes);

// Step 1-5 → draft or auto-final if all parts present
routes.post(
  "/create-campaign",
  authenticateUser(["Vendor"]),
  upload.fields([
    { name: "photo", maxCount: 1 },
    { name: "Files", maxCount: 5 },
  ]),
  createMyCampaign
);

// Step 6 → Finalize Campaign button
routes.post(
  "/finalize-campaign",
  authenticateUser(["Vendor"]),
  finalizeCampaign
);


routes.get("/campaign/:campaignId", authenticateUser(["Vendor"]), getCampaign);


routes.post(
  "/campaign/delete-file",
  authenticateUser(["Vendor"]),
  deleteCampaignFile
);


routes.put("/edit-campaign/:campaignId",upload.fields([
    { name: "photo", maxCount: 1 },
    { name: "Files", maxCount: 5 },
  ]),authenticateUser(["Vendor"]),editCampaign);

  routes.post("/update-campaign/",upload.fields([
    { name: "photo", maxCount: 1 },
    { name: "Files", maxCount: 5 },
  ]),authenticateUser(["Vendor"]),upsertCampaign);

export default routes;
