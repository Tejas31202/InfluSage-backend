import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import authRoutes from './src/routes/AuthRoutes.js';
import cookieParser from 'cookie-parser';

import InfluencerRoutes from './src/routes/influencerroutes/InfluencerRoutes.js';
import InfluencerProfileDetailRoutes from './src/routes/influencerroutes/InfluencerProfileDetailRoutes.js';
import InfluencerDashboardRoutes from './src/routes/influencerroutes/InfluencerDashboardRoutes.js';
import VendorRoutes from './src/routes/vendorroutes/VendorRoute.js';
import VendorProfileDetailRoutes from './src/routes/vendorroutes/VendorProfileDetailRoutes.js';
import VendorCampaignRoutes from './src/routes/vendorroutes/VendorCampaignRoutes.js';
import InfluencerCampaignRoutes from './src/routes/influencerroutes/InfluencerCampaignRoutes.js';
import VendorBrowseInfluencerRoutes from './src/routes/vendorroutes/VendorBrowseInfluencerRoutes.js';
import VendorOffersRoutes from './src/routes/vendorroutes/VendorOffersRoutes.js';
import VendorDashboardRoutes from './src/routes/vendorroutes/VendorDashboardRoutes.js';
import CommonRoutes from './src/routes/CommonRoutes.js';
import { createServer } from 'http';
import { Server } from 'socket.io';
import ChatRoutes from './src/routes/ChatRoutes.js';
import VendorMyCampaignRoutes from './src/routes/vendorroutes/VendorMyCampaignRoutes.js';
import InfluencerMyCampaignRoutes from './src/routes/influencerroutes/InfluencerMyCampaignRoutes.js';
import NotificationRoutes  from './src/routes/NotificationRoutes.js';
import AdminPanelRoutes from './src/routes/AdminPanelRoutes.js';

dotenv.config();

const app = express();

// Middleware
app.use(express.json());
app.use(cookieParser());

app.use(
  "/src/uploads",
  express.static(path.join(process.cwd(), "src/uploads"))
);
app.use(express.urlencoded({ extended: true }));
app.use(
  cors({
    origin: ["https://influsage-uat.netlify.app"], // your Netlify URL
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true, // if using cookies or auth headers
  })
);





dotenv.config(); // if app in src

app.use("/auth", authRoutes);
app.use("/", CommonRoutes);
app.use("/user", InfluencerRoutes);
app.use("/user", InfluencerProfileDetailRoutes);
app.use("/user", InfluencerCampaignRoutes);
app.use("/user", InfluencerMyCampaignRoutes);
app.use("/user", InfluencerDashboardRoutes);
app.use("/vendor", VendorRoutes);
app.use("/vendor", VendorProfileDetailRoutes);
app.use("/vendor", VendorCampaignRoutes);
app.use("/vendor", VendorBrowseInfluencerRoutes);
app.use("/vendor", VendorOffersRoutes);
app.use("/vendor", VendorMyCampaignRoutes);
app.use("/vendor",VendorDashboardRoutes);
app.use("/chat", ChatRoutes);
app.use("/new",NotificationRoutes);
app.use("/admin",AdminPanelRoutes);

const PORT = process.env.BACKEND_PORT || 3001;

// --------------------
// Create HTTP server & attach Socket.IO
// --------------------
const server = createServer(app);
const onlineUsers = new Map();

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  },
});

io.on("connection", (socket) => {
  // console.log("🔗 User connected:", socket.id);

  // User registers
  socket.on("register", (userId) => {
    onlineUsers.set(userId, socket.id);
    socket.userId = userId;

    // Notify all other users
    socket.broadcast.emit("user-online", { userId });

    // Send current online users to this socket
    socket.emit("online-users", { userIds: [...onlineUsers.keys()] });

    console.log(`User ${userId} registered`);
  });

  // Join room (conversation)
  socket.on("joinRoom", (conversationId) => {
    socket.join(conversationId);
    console.log(`Socket ${socket.id} joined room ${conversationId}`);
  });

  socket.on("leaveRoom", (conversationId) => {
    socket.leave(conversationId);
    console.log(`Socket ${socket.id} left room ${conversationId}`);
  });

  socket.on("deleteMessage", ({ messageId, conversationId }) => {
    io.to(conversationId).emit("deleteMessage", messageId);
    console.log(`Message ${messageId} marked as deleted in room ${conversationId}`);
  });

  // Undo delete broadcast
  socket.on("undoDeleteMessage", ({ messageId, conversationId }) => {
    io.to(conversationId).emit("undoDeleteMessage", messageId);
    console.log(`Message ${messageId} restored in room ${conversationId}`);
  });

  // Message sent
  socket.on("sendMessage", (message) => {
    const { conversationId } = message;
    console.log(`Message received for room ${conversationId}`);
    socket.to(conversationId).emit("receiveMessage", message);
  });

  // Disconnect
  socket.on("disconnect", () => {
    const userId = socket.userId;
    if (userId) {
      onlineUsers.delete(userId);
      socket.broadcast.emit("user-offline", {
        userId,
        lastSeen: new Date(),
      });
      console.log(`User ${userId} disconnected`);
    }
  });

  socket.on("messageRead", async ({ messageId, conversationId, role }) => {
    // 1. Update DB: mark message as read by this role
    // e.g. set readbyvendor = true if role === vendor, etc.

    // 2. Broadcast updated read status to the room
    io.to(`conversation_${conversationId}`).emit("updateMessageStatus", {
      messageId,
      readbyvendor: role === 1 ? true : undefined,
      readbyinfluencer: role === 2 ? true : undefined,
    });
  });



// Edit message
socket.on("editMessage", ({ id, content, file, conversationId, replyId }) => {
  if (!id || !conversationId) {
    console.log("⚠️ Missing id or conversationId in editMessage", { id, conversationId });
    return;
  }
  io.to(conversationId).emit("editMessage", { id, content, file, replyId });
  console.log(`Message ${id} edited in room ${conversationId}`);
});

});


// Start server using HTTP server
server.listen(PORT, () => {
  console.log("Server started on port", PORT);
});