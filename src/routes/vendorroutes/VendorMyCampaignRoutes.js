import express from 'express';
import {
  getCampaignStatus,
  getMyAllCampaign,
  getSingleCampaign,
  getCancleReasonList,
  insertCampiginCancleApplication,
  pausedCampaignApplication,
} from '../../controller/vendorcontroller/VendorMyCampaignController.js';
import authenticateUser from '../../middleware/AuthMiddleware.js';
import authorizeOwnership from '../../middleware/AuthorizationOwnership.js';

const routes = express.Router();

routes.get("/campaignstatus", getCampaignStatus);

routes.get("/reason-list", getCancleReasonList);

routes.post(
  "/pause-campaign/:p_campaignid",
  authenticateUser(["Vendor"]),
  pausedCampaignApplication
);

routes.post(
  "/cancle-campaign",
  authenticateUser(["Vendor"]),
  insertCampiginCancleApplication
);

routes.get("/allcampaign", authenticateUser(["Vendor"]), getMyAllCampaign);

routes.get(
  "/singlecampaign/:p_campaignid",
  authenticateUser(["Vendor", "Admin"]),
  authorizeOwnership({ idParam: "p_campaignid" }),
  getSingleCampaign
);

export default routes;
