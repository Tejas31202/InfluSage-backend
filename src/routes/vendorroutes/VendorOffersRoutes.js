import express from 'express';
import {
  getOffersForCampaign,
  getViewAllOffersForSingleCampaign,
  updateApplicationStatus,
  getOfferDetails,
} from '../../controller/vendorcontroller/VendorOffersController.js';
import authenticateUser from '../../middleware/AuthMiddleware.js';

const routes = express.Router();

routes.get("/all-offers", authenticateUser(["Vendor"]), getOffersForCampaign);
routes.get(
  "/view-all-offers/:campaignId",
  authenticateUser(["Vendor"]),
  getViewAllOffersForSingleCampaign
);
routes.post(
  "/application-status",
  authenticateUser(["Vendor"]),
  updateApplicationStatus
);
routes.get(
  "/offer-detail/:applicationId",
  authenticateUser(["Vendor"]),
  getOfferDetails
);

export default routes;
