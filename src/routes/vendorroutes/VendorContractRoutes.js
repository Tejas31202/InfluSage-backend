import express from'express';
import {
  getAllSelectedInfluencer,
  createOrEditContract,
  getContractDetailByContractId,
  getAllContractList,
  getAllContentLinks,
} from '../../controller/vendorcontroller/VendorContractController.js';
import authenticateUser from '../../middleware/AuthMiddleware.js';

const routes = express.Router();

routes.get(
  "/selected/influencer",
  authenticateUser(["Vendor"]),
  getAllSelectedInfluencer
);

routes.post(
  "/create-or-edit/contract",
  authenticateUser(["Vendor"]),
  createOrEditContract
);

routes.get(
  "/contract-detail/:p_contractid",
  authenticateUser(["Vendor"]),
  getContractDetailByContractId
);

routes.get(
  "/contract/list/:p_campaignid",
  authenticateUser(["Vendor"]),
  getAllContractList
);

routes.get(
  "/content-links/:p_campaignid",
  authenticateUser(["Vendor"]),
  getAllContentLinks
);

export default routes;

