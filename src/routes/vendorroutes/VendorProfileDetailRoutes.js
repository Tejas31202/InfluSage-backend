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
import { upload } from '../../middleware/MulterMiddleware.js';

const routes = express.Router();

routes.get("/company-sizes", getCompanySizes);
routes.get("/influencer-tiers", getInfluencerTiers);
routes.get("/objectives", getObjectives);
routes.get("/email/:email", getUserNameByEmail);

routes.post(
  "/complete-vendor-profile",
  authenticateUser(["Vendor"]),
  upload.single("photo"),
  completeVendorProfile
);

routes.get("/profile/:userId", authenticateUser(["Vendor"]), getVendorProfile);

export default routes;
