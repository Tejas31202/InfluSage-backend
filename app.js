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
import UserAdminSupportChatRoutes from './src/routes/UserAdminSupportChatRoutes.js';
import { client } from "./src/config/Db.js";
import VendorContractRoutes from './src/routes/vendorroutes/VendorContractRoutes.js';

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
    origin: "http://localhost:5173",
    credentials: true,
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
app.use("/vendor",VendorContractRoutes);
app.use("/chat", ChatRoutes);
app.use("/new",NotificationRoutes);
app.use("/admin",AdminPanelRoutes);
app.use("/chat/support",UserAdminSupportChatRoutes)

const PORT = process.env.BACKEND_PORT || 3001;

// --------------------
// Create HTTP server & attach Socket.IO
// --------------------
const server = createServer(app);
const onlineUsers = new Map();

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

io.on("connection", (socket) => {
  console.log("🔗 User connected:", socket.id);

  // User registers
  socket.on("register", async (userId) => {
    onlineUsers.set(userId, socket.id);
    socket.userId = userId;

    // Notify all other users
    socket.broadcast.emit("user-online", { userId });

    // Send current online users to this socket
    socket.emit("online-users", { userIds: [...onlineUsers.keys()] });

    console.log(`User ${userId} registered`);

    // FETCH ALL NOTIFICATIONS FROM DB
    try {
      const notifs = await client.query(
        `select * from ins.fn_get_notificationlist($1::bigint, $2::boolean)`,
        [userId, null]
      );

      const result = notifs.rows[0]?.fn_get_notificationlist || [];

      socket.emit("receiveAllNotifications", result);

      console.log(`Sent ${result.length} notifications to user ${userId}`);
    } catch (err) {
      console.log("Notification fetch error", err);
    }
    

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


  
// SOCKET.IO NOTIFICATION HANDLER
socket.on("sendNotification", async ({ receiverId, type, extra }) => {
  try {
    // FETCH notification type info from DB
    const typeRes = await client.query(
      `SELECT id, title FROM ins.notifications WHERE type = $1 AND is_active = true`,
      [type]
    );

    const notifType = typeRes.rows[0];
    if (!notifType) {
      console.log("Invalid notification type:", type);
      return;
    }

    // SAVE to user notification table
    await client.query(
      `INSERT INTO ins.user_notifications(user_id, notification_id, extra_data, created_at)
       VALUES($1, $2, $3, NOW())`,
      [receiverId, notifType.id, JSON.stringify(extra)]
    );

    // Prepare notif object
    const notifObj = {
      id: notifType.id,
      type,
      title: notifType.title,
      extra: extra || {},
      createdAt: new Date(),
    };

    // Send live notification if user is online
    const receiverSocket = onlineUsers.get(receiverId);
    if (receiverSocket) {
      io.to(receiverSocket).emit("receiveNotification", notifObj);
      console.log(`LIVE Notification sent to user ${receiverId}`);
    } else {
      console.log(`User ${receiverId} OFFLINE — saved only`);
    }
  } catch (err) {
    console.error("Error sending notification:", err);
  }
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
    
    io.to(`conversation_${conversationId}`).emit("updateMessageStatus", {
      messageId,
      readbyvendor: role === 1 ? true : undefined,
      readbyinfluencer: role === 2 ? true : undefined,
    });
  });

// Edit message
socket.on("editMessage", ({ id, content, file, conversationId, replyId }) => {
  if (!id || !conversationId) {
    console.log("Missing id or conversationId in editMessage", { id, conversationId });
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
