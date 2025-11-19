import express from 'express';
const routes=express.Router();
import authenticateUser from '../middleware/AuthMiddleware.js';
import {upload} from '../middleware/MulterMiddleware.js';
import {
  getSubjectListByRole,
  createTicketAndUpdateStatus,
  viewAllTicketByUserId,
  openChatByTicketIdForUser,
  getTicketStatus,
  openChatByTicketIdForAdmin,
  sendSupportMessage 
} from "../controller/UserAdminSupportChatController.js";

routes.get("/ticket-status",getTicketStatus);

//Chat Support System==> Influencer/Vender

routes.get("/user/get-subject",authenticateUser(["Influencer","Vendor"]),getSubjectListByRole);

routes.get("/user/open-chat",authenticateUser(["Influencer","Vendor"]),openChatByTicketIdForUser);

//Chat Support System==> Admin

routes.get("/admin/open-chat",authenticateUser(["Admin"]),openChatByTicketIdForAdmin);

//send message -->Influencer/Vender <==> Admin
routes.post("/user-admin/send-message",authenticateUser(["Influencer","Vendor","Admin"]),upload.single("file"),sendSupportMessage );
routes.post("/ticket/create-or-update-status",authenticateUser(["Influencer","Vendor","Admin"]),createTicketAndUpdateStatus);
routes.get("/user-admin/all-tickets",authenticateUser(["Influencer","Vendor","Admin"]),viewAllTicketByUserId);
export default routes;