import express from 'express';
import {
  resolveUsername,
  createConversation,
  startConversation,
  insertMessage,
  sendMessage,
  getMessages,
  deleteMessage,

} from '../controller/ChatConversationController.js';
import { upload } from '../middleware/ChatMulterMiddleware.js';
import authenticateUser from '../middleware/AuthMiddleware.js';

const routes = express.Router();

// Create a new conversation

routes.post("/startconversation", startConversation);
routes.post("/insertmessage", authenticateUser(["Influencer", "Vendor"]),resolveUsername,upload.array("files", 1), insertMessage);

routes.post("/conversation", createConversation);

// Send a message
routes.post("/message", sendMessage);

// Get all messages for a conversation
routes.get("/messages", getMessages);

// Delete a message
routes.delete("/message", deleteMessage);

export default routes;
