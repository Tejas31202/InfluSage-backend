import express from 'express';
import {
  resolveUsername,
  startConversation,
  insertMessage,
  getConversationsdetails,
  // getCampaigns,
  // getInfluencers,
  // getVendors,
  getMessages,
  updateUndoMessage,
  unreadMessageList
  // deleteMessage,

} from '../controller/ChatConversationController.js';
import { upload } from '../middleware/ChatMulterMiddleware.js';
import authenticateUser from '../middleware/AuthMiddleware.js';

const routes = express.Router();

// Create a new conversation

routes.post("/startconversation", authenticateUser(["Vendor"]), startConversation);
routes.post("/insertmessage", authenticateUser(["Influencer", "Vendor"]),resolveUsername,upload.array("file", 1), insertMessage);
routes.get("/conversationsdetails", authenticateUser(["Influencer", "Vendor"]), getConversationsdetails);
// routes.get("/conversationsdetails/campaigns", authenticateUser(["Influencer", "Vendor"]), getCampaigns);
// routes.get("/conversationsdetails/influencers", authenticateUser(["Influencer","Vendor"]), getInfluencers);
// routes.get("/conversationsdetails/vendors", authenticateUser(["Influencer","Vendor"]), getVendors);
routes.put("/undodeletemessage", authenticateUser(["Influencer", "Vendor"]), updateUndoMessage);
routes.get("/unread-messages",authenticateUser(["Influencer", "Vendor"]),unreadMessageList);



// Get all messages for a conversation
routes.get("/messages", getMessages);

// Delete a message
// routes.delete("/message", deleteMessage);

export default routes;
