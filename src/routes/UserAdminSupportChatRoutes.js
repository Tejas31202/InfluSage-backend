import express from 'express';
const routes=express.Router();
import authenticateUser from '../middleware/AuthMiddleware.js';
import {getSubjectListByRole,createNewTicket,viewAllTicketByUserId,openChatByTicketIdForUser,changeTicketStatus} from '../controller/UserAdminSupportChatController.js'

routes.get("/user/get-subject",authenticateUser(["Influencer","Vender"]),getSubjectListByRole);
routes.post("/user/create-ticket",authenticateUser(["Influencer","Vender"]),createNewTicket);
routes.get("/user/all-tickets",authenticateUser(["Influencer","Vender"]),viewAllTicketByUserId);
routes.get("/user/chat",authenticateUser(["Influencer","Vender"]),openChatByTicketIdForUser);
routes.post("/user/change-status",authenticateUser(["Influencer","Vender"]),changeTicketStatus);

export default routes;