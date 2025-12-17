import express from 'express';
import {
  getCampaign,
  deleteCampaignFile,
  finalizeCampaign,
  getCampaignObjectives,
  getProvidorContentTypes,
  upsertCampaign,
} from '../../controller/vendorcontroller/VendorCampaignController.js';
import authenticateUser from '../../middleware/AuthMiddleware.js';
import { upload } from '../../middleware/MulterMiddleware.js';

const routes = express.Router();

routes.get("/campaign/objectives", getCampaignObjectives);

routes.get("/provider-content-type", getProvidorContentTypes);

// Step 6 → Finalize Campaign button
routes.post(
  "/finalize-campaign",
  authenticateUser(["Vendor"]),
  finalizeCampaign
);

routes.get(
  "/campaign/:campaignId",
  authenticateUser(["Vendor", "Admin"]),
  getCampaign
);

routes.post(
  "/campaign/delete-file",
  authenticateUser(["Vendor"]),
  deleteCampaignFile
);

routes.post(
  "/update-campaign/",
  upload.fields([
    { name: "photo", maxCount: 1 },
    { name: "Files", maxCount: 5 },
  ]),
  authenticateUser(["Vendor"]),
  upsertCampaign
);

export default routes;
