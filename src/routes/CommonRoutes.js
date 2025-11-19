import express from 'express';
import {
  getRoles,
  getContentTypes,
  getGenders,
  getLanguages,
  getCategories,
  getProviders,
  getInfluencerTiers,
  getUserNameAndPhoto
} from '../controller/CommonController.js';
import authenticateUser from '../middleware/AuthMiddleware.js';

const routes = express.Router();

routes.get("/roles", getRoles);
routes.get("/content-type", getContentTypes);
routes.get("/genders", getGenders);
routes.get("/languages", getLanguages);
routes.get("/categories", getCategories);
routes.get("/providers", getProviders);
routes.get("/influencer-type", getInfluencerTiers);
routes.get("/user-profile-info",authenticateUser(["Influencer","Vendor","Admin"]),getUserNameAndPhoto);

export default routes;
