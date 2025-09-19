import express from "express";
import {
  createConversation,
  sendMessage,
  getMessages,
  deleteMessage,
} from "../controller/ChatConversation.js";

const router = express.Router();

// Create a new conversation
router.post("/conversation", createConversation);

// Send a message
router.post("/message", sendMessage);

// Get all messages for a conversation
router.get("/messages", getMessages);

// Delete a message
router.delete("/message", deleteMessage);

export default router;
