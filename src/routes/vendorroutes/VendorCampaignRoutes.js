import express from 'express';
import {
  createMyCampaign,
  getCampaign,
  deleteCampaignFile,
  finalizeCampaign,
  getCampaignObjectives,
  getInfluencerTiers,
  getProvidorContentTypes,
  getInfluencerBrowseDetails,
  browseAllInfluencer,
  addFavouriteInfluencer,
  getFavouriteInfluencer
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

routes.get("/influencer/browse", getInfluencerBrowseDetails);

routes.get("/allinfluencer/browse", browseAllInfluencer);

routes.post('/addfavourite/influencer',addFavouriteInfluencer);

routes.get('/getfavourite/influencer',getFavouriteInfluencer);

routes.post(
  "/campaign/delete-file",
  authenticateUser(["Vendor"]),
  deleteCampaignFile
);

export default routes;
