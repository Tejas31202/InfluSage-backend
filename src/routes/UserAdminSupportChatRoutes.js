import express from 'express';
const routes=express.Router();
import authenticateUser from '../middleware/AuthMiddleware.js';
import {upload} from '../middleware/MulterMiddleware.js';
import {
  // Influencer / Vender
  getSubjectListByRole,
  createNewTicket,
  viewAllTicketByUserId,
  openChatByTicketIdForUser,
  changeTicketStatus,
  // Admin
  ViewAllTicketAdminSide,
  claimTicketByAdmin,
  openChatByTicketIdForAdmin,
  resolveTicketByAdmin,
  // both send message
  supportMessageSend
} from "../controller/UserAdminSupportChatController.js";

//Chat Support System==> Influencer/Vender

routes.get("/user/get-subject",authenticateUser(["Influencer","Vendor"]),getSubjectListByRole);
routes.post("/user/create-ticket",authenticateUser(["Influencer","Vendor"]),createNewTicket);
routes.get("/user/all-tickets",authenticateUser(["Influencer","Vendor"]),viewAllTicketByUserId);
routes.get("/user/open-chat",authenticateUser(["Influencer","Vendor"]),openChatByTicketIdForUser);
routes.post("/user/change-status",authenticateUser(["Influencer","Vendor"]),changeTicketStatus);

//Chat Support System==> Admin

routes.get("/admin/all-tickets",authenticateUser(["Admin"]),ViewAllTicketAdminSide);
routes.post("/admin/claim-ticket",authenticateUser(["Admin"]),claimTicketByAdmin);
routes.get("/admin/open-chat",authenticateUser(["Admin"]),openChatByTicketIdForAdmin);
routes.post("/admin/resolve-ticket",authenticateUser(["Admin"]),resolveTicketByAdmin);

//send message -->Influencer/Vender <==> Admin
routes.post("/user-admin/send-message",upload.single("file"),supportMessageSend);
export default routes;