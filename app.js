import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import authRoutes from './src/routes/AuthRoutes.js';
import cookieParser from 'cookie-parser';
import Redis from './src/utils/RedisWrapper.js';

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
import VendorAnalyticsDashboardRoutes from './src/routes/vendorroutes/VendorAnalyticsDashboardRoutes.js';
import CommonRoutes from './src/routes/CommonRoutes.js';
import { createServer } from 'http';
import { Server } from 'socket.io';
import ChatRoutes from './src/routes/ChatRoutes.js';
import VendorMyCampaignRoutes from './src/routes/vendorroutes/VendorMyCampaignRoutes.js';
import InfluencerMyCampaignRoutes from './src/routes/influencerroutes/InfluencerMyCampaignRoutes.js';
import NotificationRoutes from './src/routes/NotificationRoutes.js';
import AdminPanelRoutes from './src/routes/AdminPanelRoutes.js';
import AdminAnalyticsDashboardRoutes from './src/routes/adminroutes/AdminAnalyticsDashboardRoutes.js';
import UserAdminSupportChatRoutes from './src/routes/UserAdminSupportChatRoutes.js';
import { client } from "./src/config/Db.js";
import VendorContractRoutes from './src/routes/vendorroutes/VendorContractRoutes.js';
import InfluencerContractRoutes from './src/routes/influencerroutes/InfluencerContractRoutes.js';
import VendorFeedBackRoutes from './src/routes/vendorroutes/VendorFeedBackRoutes.js';
import InfluencerAnalyticsDashboardRoutes  from './src/routes/influencerroutes/InfluencerAnalyticsDashboardRoutes.js';
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
    origin: process.env.FRONTEND_URL, // your Netlify URL
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
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
app.use("/user", InfluencerContractRoutes);
app.use("user",InfluencerAnalyticsDashboardRoutes);
app.use("/vendor", VendorRoutes);
app.use("/vendor", VendorProfileDetailRoutes);
app.use("/vendor", VendorCampaignRoutes);
app.use("/vendor", VendorBrowseInfluencerRoutes);
app.use("/vendor", VendorOffersRoutes);
app.use("/vendor", VendorMyCampaignRoutes);
app.use("/vendor", VendorDashboardRoutes);
app.use("/vendor", VendorContractRoutes);
app.use("/vendor", VendorFeedBackRoutes);
app.use("/vendor",VendorAnalyticsDashboardRoutes);
app.use("/chat", ChatRoutes);
app.use("/new", NotificationRoutes);
app.use("/admin", AdminPanelRoutes);
app.use("/admin",AdminAnalyticsDashboardRoutes);
app.use("/chat/support", UserAdminSupportChatRoutes)

const PORT = process.env.BACKEND_PORT || 3001;

// --------------------
// Create HTTP server & attach Socket.IO
// --------------------

const server = createServer(app);
const onlineUsers = new Map();

// 🔥 Track already-sent notifications (socket-memory based)
const sentNotificationMap = new Map();
/*
  Structure:
  sentNotificationMap = {
    userId: Set(notificationId)
  }
*/

const redisType = process.env.REDIS_PROVIDER === "Local" ? "Upstash" : "Local";
console.log(`🚀 Redis type active: ${redisType}`);

(async () => {
  try {
    await Redis.set("connection:test", { status: "ok", Redis: redisType });
    const test = await Redis.get("connection:test");
    console.log("✅ Redis connected successfully:", test);
  } catch (err) {
    console.error("❌ Redis connection failed:", err);
  }
})();

export const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  },
});

io.on("connection", (socket) => {
  console.log("🔗 User connected:", socket.id);

// new changes on to once 
  socket.once("register", async (userId) => {
    try {

      //if user id missing thn return here
      if (!userId) {
        console.warn("❌ UserId missing during register");
        return;
      }
      socket.userId = userId;
      onlineUsers.set(userId, socket.id);

      // FRONTEND EXPECTS THIS ROOM Connects Only Once
      socket.join(`user_${userId}`);
      socket.join(`notification_${userId}`)
      console.log(`✅ User ${userId} registered`)

      socket.broadcast.emit("user-online", { userId });
      socket.emit("online-users", {
        userIds: [...onlineUsers.keys()],
      });

      /* ---- FETCH LATEST NOTIFICATION (UNCHANGED) ---- */
      const p_role = "RECEIVER";

      const notifs = await client.query(
        `SELECT * FROM ins.fn_get_notificationlist($1::bigint, $2::boolean, $3::text)`,
        [userId, null, p_role]
      );


      const notifyData = notifs.rows[0]?.fn_get_notificationlist || [];

      if (notifyData.length > 0) {
        io.to(`user_${userId}`).emit(
          "receiveNotification",
          notifyData
        );
      }

      console.log("📡 Sent unsent notifications:", notifyData.length);
    } catch (err) {
      console.error("Register error:", err);
    }
  });

  socket.on("clearPopupNotifications", ({ userId }) => {
    if (!userId) return;

    io.to(`user_${userId}`).emit("removePopupNotifications");
    console.log(`✅ Popup notifications cleared for user ${userId}`);
  });

  /* ---------------- FRONTEND SUPPORT EVENT ---------------- */
  // socket.on("registerUser", ({ userId }) => {
  //   socket.join(`user_${userId}`);
  // });

  /* ---------------- NOTIFICATIONS ---------------- */
// newcode Working But MaxListenersExceededWarning error solving change
  socket.on("sendNotification", async ({ toUserId, message }) => {
  try {
    if (!toUserId) return;
    io.to(`notification_${toUserId}`).emit("receiveNotification", { message });
    console.log(`🔔 Notification sent to ${toUserId}`);
  } catch(err) {
    console.error("sendNotification error:", err);
  }
});


//old code Working But MaxListenersExceededWarning error solving change
  // socket.on("sendNotification", ({ toUserId, message }) => {
  //   io.to(`notification_${toUserId}`).emit("receiveNotification", { message });
  //   console.log(`🔔 Notification sent to ${toUserId}`);
  // });

  /* ---------------- CHAT ROOMS ---------------- */
  socket.on("joinRoom", (conversationId) => {
    socket.join(conversationId); // DO NOT CHANGE
    console.log(`💬 Joined room ${conversationId}`);
  });

  socket.on("leaveRoom", (conversationId) => {
    socket.leave(conversationId);
  });

  socket.on("sendMessage", (message) => {
    socket.to(message.conversationId).emit(
      "receiveMessage",
      message
    );
  });

  socket.on("editMessage", ({ id, content, file, conversationId, replyId }) => {
    io.to(conversationId).emit("editMessage", {
      id,
      content,
      file,
      replyId,
    });
  });

  socket.on("deleteMessage", ({ messageId, conversationId }) => {
    io.to(String(conversationId)).emit("deleteMessage", {
      messageId,
      conversationId,
    });
  });

  socket.on("undoDeleteMessage", ({ messageId, conversationId }) => {
    io.to(conversationId).emit("undoDeleteMessage", messageId);
  });

  socket.on("messageRead", ({ messageId, conversationId, role }) => {
    if (!messageId || !conversationId) {
      console.log("❌ INVALID READ EVENT", { messageId, conversationId, role });
      return;
    }

    const payload = {
      messageId,
      conversationId,
      readbyinfluencer: Number(role) === 1,
      readbyvendor: Number(role) === 2,
    };
    console.log("📡 EMIT updateMessageStatus", payload);

    io.to(String(conversationId)).emit("updateMessageStatus", payload);
  });

  /* ---------------- TICKET ROOMS ---------------- */
  socket.on("joinTicketRoom", (ticketId) => {
    socket.join(`ticket_${ticketId}`);
    console.log(`🎫 Joined ticket_${ticketId}`);
  });

  socket.on("leaveTicketRoom", (ticketId) => {
    socket.leave(`ticket_${ticketId}`);
  });

  /* ---------------- DISCONNECT ---------------- */
  socket.on("disconnect", () => {
    if (socket.userId) {
      onlineUsers.delete(socket.userId);
      sentNotificationMap.delete(socket.userId);

      socket.broadcast.emit("user-offline", {
        userId: socket.userId,
        lastSeen: new Date(),
      });

      console.log(`❌ User ${socket.userId} disconnected`);
    }
  });
});


// Start server using HTTP server
server.listen(PORT, () => {
  console.log("Server started on port", PORT);
});