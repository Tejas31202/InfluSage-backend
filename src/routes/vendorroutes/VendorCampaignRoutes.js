import express from 'express';
import {
  createMyCampaign} from '../../controller/vendorcontroller/VendorCampaignController.js';
// import authenticateUser from "../../middleware/AuthMiddleware.js";
const routes = express.Router();
routes.post('/create-campaign',  createMyCampaign);
export default routes;