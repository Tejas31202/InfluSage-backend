import express from 'express';
import {
  changePassword,
  getdeleteAccountReason,
  deleteAccount
} from '../controller/SettingController.js';
import authenticateUser from '../middleware/AuthMiddleware.js';
const routes = express.Router();

routes.post(
  "/change-password",
  authenticateUser(["Influencer", "Vendor"]),
  changePassword
);

routes.get(
  "/del-account-reason",
  authenticateUser(["Influencer", "Vendor"]),
  getdeleteAccountReason
);

routes.post(
  "/del-account",
  authenticateUser(["Influencer", "Vendor"]),
  deleteAccount
)

export default routes;
