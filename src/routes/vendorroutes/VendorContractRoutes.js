import express from'express';
import {getAllSelectedInfluencer,createOrEditContract,getContractDetailByContractId,influencerApproveOrRejectContract} from '../../controller/vendorcontroller/VendorContractController.js'
import authenticateUser from '../../middleware/AuthMiddleware.js';

const routes = express.Router();

routes.get('/selected/influencer', authenticateUser(["Vendor"]),getAllSelectedInfluencer);
routes.post("/create-or-edit/contract",authenticateUser(["Vendor"]),createOrEditContract);
routes.get("/contract-detail/:p_contractid",authenticateUser(["Vendor"]),getContractDetailByContractId);
routes.post("/influencer/contract/approve-reject",authenticateUser(["Influencer"]),influencerApproveOrRejectContract);
export default routes;

