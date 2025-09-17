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

routes.get('/influencer/browse', getInfluencerBrowseDetails);

routes.get('/allinfluencer/browse', browseAllInfluencer);

routes.post('/addfavourite/influencer',addFavouriteInfluencer);

routes.get('/getfavourite/influencer',getFavouriteInfluencer);

routes.post('/campaign/invite',insertCampaignInvites);

routes.get('/inviteinfluencer/Campaigns',inviteInfluencerToCampaigns);

routes.get('/browse/inviteinfluencer',browseInviteInfluencer)





export default routes;