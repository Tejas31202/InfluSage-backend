import express from 'express';
import {
  changePassword,
  getdeleteAccountReason
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
  getdeleteAccountReason
);

export default routes;
