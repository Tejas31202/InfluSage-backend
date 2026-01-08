import express from "express";
import authenticateUser from "../../middleware/AuthMiddleware.js";
import {
  vendorInsertFeedback,
  getSelectInfluencerListForFeedback,
  getInfluencerFeedbackList,
} from "../../controller/vendorcontroller/VendorFeedBackController.js";

const routes = express.Router();

routes.get(
  "/feedback/influencer-list",
  authenticateUser(["Vendor"]),
  getSelectInfluencerListForFeedback
);

routes.post("/feedback", authenticateUser(["Vendor"]), vendorInsertFeedback);

routes.get(
  "/influencer/feedback-list",
  authenticateUser(["Vendor"]),
  getInfluencerFeedbackList
);

export default routes;
