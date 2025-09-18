import express from 'express';
import {
  getInfluencerBrowseDetails,
  browseAllInfluencer,
  addFavouriteInfluencer,
  getFavouriteInfluencer,
  insertCampaignInvites,
  inviteInfluencerToCampaigns,
  browseInviteInfluencer
} from '../../controller/vendorcontroller/VendorBrowseinfluencerController.js';
import authenticateUser from '../../middleware/AuthMiddleware.js';

const routes = express.Router();

routes.get('/influencer/browse',authenticateUser(["Vendor"]), getInfluencerBrowseDetails);

routes.get('/allinfluencer/browse',authenticateUser(["Vendor"]),browseAllInfluencer);

routes.post('/addfavourite/influencer',authenticateUser(["Vendor"]),addFavouriteInfluencer);

routes.get('/getfavourite/influencer',authenticateUser(["Vendor"]),getFavouriteInfluencer);

routes.post('/campaign/invite',authenticateUser(["Vendor"]),insertCampaignInvites);

routes.get('/inviteinfluencer/Campaigns',authenticateUser(["Vendor"]),inviteInfluencerToCampaigns);

routes.get('/browse/inviteinfluencer',authenticateUser(["Vendor"]),browseInviteInfluencer)

export default routes;