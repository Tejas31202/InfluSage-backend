import express from 'express';
import authenticateUser from '../middleware/AuthMiddleware.js';
import {getAllNotification} from '../controller/NotificationController.js';

const routes = express.Router();

routes.get(
  "/getallnotification",
  authenticateUser(["Vendor", "Influencer"]),
  getAllNotification
);

export default routes;