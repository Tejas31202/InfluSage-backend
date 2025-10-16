import express from 'express';
import authenticateUser from '../../middleware/AuthMiddleware.js';
import {
  completeUserProfile,
  getUserProfile,
  getUserNameByEmail,
  deletePortfolioFile,
} from '../../controller/influencercontroller/InfluencerProfileDetailController.js';
import { upload } from '../../middleware/MulterMiddleware.js';

const routes = express.Router();

routes.post(
  "/complete-profile",
  authenticateUser(["Influencer"]),
  upload.fields([
    { name: "photo", maxCount: 1 },
    { name: "portfolioFiles", maxCount: 5 },
  ]),
  completeUserProfile
);

routes.get(
  "/profile/:userId",
  authenticateUser(["Influencer","Admin"]),
  getUserProfile
);

routes.get("/email/:email", getUserNameByEmail);

routes.post(
  "/profile/delete-portfolio-file",
  authenticateUser(["Influencer"]),
  deletePortfolioFile
);

export default routes;
