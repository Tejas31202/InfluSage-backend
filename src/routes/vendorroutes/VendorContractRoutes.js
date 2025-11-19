import express from'express';
import {getAllSelectedInfluencer} from '../../controller/vendorcontroller/VendorContractController.js'
import authenticateUser from '../../middleware/AuthMiddleware.js';

const routes = express.Router();

routes.get('/selected/influencer', authenticateUser(["Vendor"]),getAllSelectedInfluencer);



export default routes;

