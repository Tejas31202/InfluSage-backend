import express from 'express';
import {
  startConversation,
  insertMessage,
  getConversationsdetails,
  getMessages,
  updateUndoMessage,
  unreadMessageList
} from '../../controller/chatcontroller/ChatConversationController.js';
import { upload } from '../../middleware/MulterMiddleware.js';
import authenticateUser from '../../middleware/AuthMiddleware.js';

const routes = express.Router();

// Create a new conversation

routes.post(
  "/startconversation",
  authenticateUser(["Vendor"]),
  startConversation
);

routes.post(
  "/insertmessage",
  authenticateUser(["Influencer", "Vendor"]),
  upload.array("file", 5),
  insertMessage
);

routes.get(
  "/conversationsdetails",
  authenticateUser(["Influencer", "Vendor"]),
  getConversationsdetails
);

routes.put(
  "/undodeletemessage",
  authenticateUser(["Influencer", "Vendor"]),
  updateUndoMessage
);

routes.get(
  "/unread-messages",
  authenticateUser(["Influencer", "Vendor"]),
  unreadMessageList
);

// Get all messages for a conversation
routes.get(
  "/messages",
  authenticateUser(["Influencer", "Vendor"]),
  getMessages,
);

export default routes;
