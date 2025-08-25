import express from 'express';
import authenticateUser from "../../middleware/AuthMiddleware.js";
import {
  completeUserProfile,
  getUserProfile,
  getUserNameByEmail,
  getCategories
} from '../../controller/influencercontroller/InfluencerProfileDetailController.js';
 
 
const routes = express.Router();
 
// console.log("PDController:", PDController);
// POST request to complete user profile
//Changes For Role Based Auth.. =>authenticateUser(['Influencer'])
routes.post('/complete-profile', authenticateUser(['Influencer']),completeUserProfile);
routes.get('/profile/:userId', authenticateUser(['Influencer']), getUserProfile);
routes.get('/:email', getUserNameByEmail);
routes.get('/categories',getCategories);
 
export default routes;