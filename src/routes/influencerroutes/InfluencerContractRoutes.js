import express from 'express';
const routes=express.Router();
import {influencerApproveOrRejectContract,uploadContentLink,getInfluencerContractDetail,getInfluencerUploadedContentLink} from '../../controller/influencercontroller/InfluencerContractController.js';
import authenticateUser from '../../middleware/AuthMiddleware.js';

routes.post("/contract/approve-reject",authenticateUser(["Influencer"]),influencerApproveOrRejectContract);
routes.post("/upload/content-link",authenticateUser(["Influencer"]),uploadContentLink);
routes.get("/contract-detail/:p_campaignid",authenticateUser(["Influencer"]),getInfluencerContractDetail);
routes.get("/content-links/:p_campaignid",authenticateUser(["Influencer"]),getInfluencerUploadedContentLink);

export default routes;