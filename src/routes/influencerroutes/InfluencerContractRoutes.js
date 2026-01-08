import express from 'express';
const routes = express.Router();
import {
    influencerApproveOrRejectContract,
    uploadContentLink,
    getInfluencerContractDetail,
    getInfluencerUploadedContentLink,
    getContractContentTypes,
    addVendorFeedback
} from '../../controller/influencercontroller/InfluencerContractController.js';
import authenticateUser from '../../middleware/AuthMiddleware.js';

routes.post(
  "/contract/approve-reject",
  authenticateUser(["Influencer"]),
  influencerApproveOrRejectContract
);

routes.post(
  "/upload/content-link",
  authenticateUser(["Influencer"]),
  uploadContentLink
);

routes.get(
  "/contract-detail/:p_campaignid",
  authenticateUser(["Influencer"]),
  getInfluencerContractDetail
);

routes.get(
  "/content-links/:p_campaignid",
  authenticateUser(["Influencer"]),
  getInfluencerUploadedContentLink
);

routes.get(
  "/contracts/:p_contractid/content-types",
  authenticateUser(["Influencer"]),
  getContractContentTypes
);

routes.post(
  "/add-feedback",
  authenticateUser(["Influencer"]),
  addVendorFeedback
);

export default routes;