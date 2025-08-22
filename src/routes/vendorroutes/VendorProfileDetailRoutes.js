import express from 'express';
import { 
  getVendorCategories, 
  getCompanySizes, 
  getInfluencerTiers, 
  completeVendorProfile, 
  getVendorProfile, 
  getObjectives, 
  getUserNameByEmail 
} from '../../controller/vendorcontroller/VendorProfileDetailController.js';
import authenticateUser from "../../middleware/AuthMiddleware.js";

const routes = express.Router();

routes.get("/categories", getVendorCategories);
routes.get("/company-sizes", getCompanySizes);
routes.get("/influencer-tiers", getInfluencerTiers);
routes.post("/complete-vendor-profile",authenticateUser,completeVendorProfile);
routes.get('/profile/:userId',getVendorProfile);
routes.get('/objectives', getObjectives);
routes.get('/:email', getUserNameByEmail);

export default routes;