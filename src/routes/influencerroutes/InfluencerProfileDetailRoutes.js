import express from 'express';
import { 
  completeUserProfile, 
  getUserProfile, 
  getUserNameByEmail, 
  getCategories
} from '../../controller/influencercontroller/InfluencerProfileDetailController.js';
import authenticateUser from "../../middleware/AuthMiddleware.js";

const routes = express.Router();

// console.log("PDController:", PDController);
// POST request to complete user profile
routes.post('/complete-profile', completeUserProfile);
routes.get('/profile/:userId', authenticateUser, getUserProfile);
routes.get('/:email', getUserNameByEmail);
routes.get('/categories', getCategories);

export default routes;