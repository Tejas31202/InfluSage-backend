import express from 'express';
import {
  getCompanySizes,
  getInfluencerTiers,
  completeVendorProfile,
  getVendorProfile,
  getObjectives,
  getUserNameByEmail,
} from '../../controller/vendorcontroller/VendorProfileDetailController.js';
import authenticateUser from '../../middleware/AuthMiddleware.js';
import { uploadVendor } from '../../middleware/MulterVenderMiddelware.js';

const routes = express.Router();

routes.get("/company-sizes", getCompanySizes);
routes.get("/influencer-tiers", getInfluencerTiers);
routes.post(
  "/complete-vendor-profile",
  authenticateUser(["Vendor"]),
  uploadVendor.single("photo"),
  completeVendorProfile
);
routes.get("/profile/:userId", authenticateUser(["Vendor"]), getVendorProfile);
routes.get("/objectives", getObjectives);
routes.get("/email/:email", getUserNameByEmail);

export default routes;
