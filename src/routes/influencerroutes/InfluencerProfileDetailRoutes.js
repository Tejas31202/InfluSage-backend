import express from 'express';
import authenticateUser from "../../middleware/AuthMiddleware.js";
import {
  completeUserProfile,
  getUserProfile,
  getUserNameByEmail,
  getCategories,
  deletePortfolioFile
} from '../../controller/influencercontroller/InfluencerProfileDetailController.js';
import {upload} from "../../middleware/MulterMiddleware.js"
 
 
const routes = express.Router();
 
// console.log("PDController:", PDController);
// POST request to complete user profile
//Changes For Role Based Auth.. =>authenticateUser(['Influencer'])
routes.post('/complete-profile', authenticateUser(["Influencer"]), upload.fields([
    { name: "photo", maxCount: 1 },
    { name: "portfolioFiles", maxCount: 5}
  ]),completeUserProfile);
routes.get('/profile/:userId', authenticateUser(['Influencer']), getUserProfile);
routes.get('/email/:email', getUserNameByEmail);
routes.get('/categories',getCategories);

routes.post(
  "/profile/delete-portfolio-file",
  authenticateUser(["Influencer"]), // optional role check
  deletePortfolioFile
);
 
export default routes;