import express from 'express';
import { changePassword } from '../controller/SettingController.js';
import authenticateUser from '../middleware/AuthMiddleware.js';

const routes = express.Router();

routes.post(
  "/change-password",
  authenticateUser(["Influencer", "Vendor"]),
  changePassword
);

export default routes;
