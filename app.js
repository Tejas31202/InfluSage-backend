import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import { Server } from 'socket.io';
import Redis from './src/utils/RedisWrapper.js';

// Routes

import { client } from "./src/config/Db.js";
import authRoutes from './src/routes/AuthRoutes.js';
import CommonRoutes from './src/routes/CommonRoutes.js';

// Influencer Routes
import InfluencerRoutes from './src/routes/influencerroutes/InfluencerRoutes.js';
import InfluencerProfileDetailRoutes from './src/routes/influencerroutes/InfluencerProfileDetailRoutes.js';
import InfluencerDashboardRoutes from './src/routes/influencerroutes/InfluencerDashboardRoutes.js';
import InfluencerCampaignRoutes from './src/routes/influencerroutes/InfluencerCampaignRoutes.js';
import InfluencerMyCampaignRoutes from './src/routes/influencerroutes/InfluencerMyCampaignRoutes.js';
import InfluencerContractRoutes from './src/routes/influencerroutes/InfluencerContractRoutes.js';
import InfluencerAnalyticsDashboardRoutes from './src/routes/influencerroutes/InfluencerAnalyticsDashboardRoutes.js';

// Vendor Routes
import VendorProfileDetailRoutes from './src/routes/vendorroutes/VendorProfileDetailRoutes.js';
import VendorCampaignRoutes from './src/routes/vendorroutes/VendorCampaignRoutes.js';
import VendorBrowseInfluencerRoutes from './src/routes/vendorroutes/VendorBrowseInfluencerRoutes.js';
import VendorOffersRoutes from './src/routes/vendorroutes/VendorOffersRoutes.js';
import VendorMyCampaignRoutes from './src/routes/vendorroutes/VendorMyCampaignRoutes.js';
import VendorDashboardRoutes from './src/routes/vendorroutes/VendorDashboardRoutes.js';
import VendorContractRoutes from './src/routes/vendorroutes/VendorContractRoutes.js';
import VendorFeedbackRoutes from './src/routes/vendorroutes/VendorFeedBackRoutes.js';
import VendorAnalyticsDashboardRoutes from './src/routes/vendorroutes/VendorAnalyticsDashboardRoutes.js';

// Admin Routes
import AdminPanelRoutes from './src/routes/adminroutes/AdminPanelRoutes.js';
import AdminAnalyticsDashboardRoutes from './src/routes/adminroutes/AdminAnalyticsDashboardRoutes.js';

// Chat & Notification Routes
import ChatRoutes from './src/routes/chatroutes/ChatRoutes.js';
import UserAdminSupportChatRoutes from './src/routes/chatroutes/UserAdminSupportChatRoutes.js';
import NotificationRoutes from './src/routes/NotificationRoutes.js';
import SettingRoutes from './src/routes/SettingRoutes.js';

dotenv.config();

const app = express();

let lastActivity = Date.now();
let getCount = 0;
let postCount = 0;

app.use((req, res, next) => {
  if (req.method === 'GET') {
    getCount++;
  }
  if (req.method === 'POST') {
    postCount++;
  }
  lastActivity = Date.now();
  next();
});

// Temporary middleware to measure API request execution time
// app.use((req, res, next) => {
//   const start = Date.now();

//   res.on("finish", () => {
//     const duration = Date.now() - start;
//     console.log(`[${req.method}] ${req.originalUrl} - ${duration}ms`);
//   });

//   next();
// });


/* =========================
   Global Middleware
========================= */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(
  cors({
    origin: process.env.FRONTEND_URL, // your Netlify URL
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);
dotenv.config(); // if app in src

/* =========================
   Auth & Common Routes
========================= */
app.use("/auth", authRoutes);
app.use("/", CommonRoutes);

/* =========================
   Influencer Routes
========================= */
app.use("/user", InfluencerRoutes);
app.use("/user", InfluencerProfileDetailRoutes);
app.use("/user", InfluencerCampaignRoutes);
app.use("/user", InfluencerMyCampaignRoutes);
app.use("/user", InfluencerDashboardRoutes);
app.use("/user", InfluencerContractRoutes);
app.use("/user", InfluencerAnalyticsDashboardRoutes);

/* =========================
   Vendor Routes
========================= */
app.use("/vendor", VendorProfileDetailRoutes);
app.use("/vendor", VendorCampaignRoutes);
app.use("/vendor", VendorBrowseInfluencerRoutes);
app.use("/vendor", VendorOffersRoutes);
app.use("/vendor", VendorMyCampaignRoutes);
app.use("/vendor", VendorDashboardRoutes);
app.use("/vendor", VendorContractRoutes);
app.use("/vendor", VendorFeedbackRoutes);
app.use("/vendor", VendorAnalyticsDashboardRoutes);

/* =========================
   Admin Routes
========================= */

app.use("/admin", AdminPanelRoutes);
app.use("/admin", AdminAnalyticsDashboardRoutes);

/* =========================
   Chat & Notifications
========================= */

app.use("/chat", ChatRoutes);
app.use("/chat/support", UserAdminSupportChatRoutes);
app.use("/new", NotificationRoutes);
app.use("/setting", SettingRoutes);

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

const redisType = process.env.REDIS_PROVIDER === "Upstash" ? "Upstash" : "Local";
console.log(`Redis type active: ${redisType}`);

(async () => {
  try {
    await Redis.set("connection:test", { status: "ok", Redis: redisType });
    const test = await Redis.get("connection:test");
    console.log("Redis connected successfully:", test);
  } catch (err) {
    console.error("Redis connection failed:", err);
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

let socketConnectCount = 0;
let socketDisconnectCount = 0;

io.on("connection", (socket) => {
  console.log("🔗 User connected:", socket.id);
  socketConnectCount++;
  lastActivity = Date.now();
  console.log("🟢 Socket connected:", socket.id);

  /* ---------------- REGISTER USER ---------------- */
  // socket.on("register", async (userId) => {
  //   try {
  //     socket.userId = userId;

  //     onlineUsers.set(userId, socket.id);

  //     // FRONTEND EXPECTS THIS ROOM
  //     socket.join(`user_${userId}`);
  //     socket.join(`notification_${userId}`)
  //     console.log(`User ${userId} registered`)

  //     socket.broadcast.emit("user-online", { userId });
  //     socket.emit("online-users", {
  //       userIds: [...onlineUsers.keys()],
  //     });

  //     /* ---- FETCH LATEST NOTIFICATION (UNCHANGED) ---- */
  //     const p_role = "RECEIVER";

  //     const notifs = await client.query(
  //       `SELECT * FROM ins.fn_get_notificationlist($1::bigint, $2::boolean, $3::text)`,
  //       [userId, null, p_role]
  //     );


  //     const notifyData = notifs.rows[0]?.fn_get_notificationlist || [];
  //     const lastThree = notifyData.slice(-3);

  //     // 🔥 Already sent notification IDs for this user
  //     const sentIds = sentNotificationMap.get(userId) || new Set();

  //     // 🔥 Filter only unsent notifications
  //     const unsentNotifications = lastThree.filter(
  //       (n) => !sentIds.has(n.id)   // ⚠️ id column must exist in notification
  //     );

  //     if (unsentNotifications.length > 0) {
  //       io.to(`user_${userId}`).emit(
  //         "receiveNotification",
  //         unsentNotifications
  //       );

  //       // if (notifyData.length > 0) {
  //       // io.to(`user_${userId}`).emit(
  //       //   "receiveNotification",
  //       //   notifyData
  //       // );


  //       // 🔥 Mark these notifications as sent (in memory)
  //       const updatedSet = sentNotificationMap.get(userId) || new Set();
  //       unsentNotifications.forEach(n => updatedSet.add(n.id));
  //       sentNotificationMap.set(userId, updatedSet);
  //     }

  //     console.log("Sent unsent notifications:", unsentNotifications.length);

  //     // console.log(`User ${userId} registered`);
  //   } catch (err) {
  //     console.error("Register error:", err);
  //   }
  // });


  socket.on("register", async (userId) => {
    try {
      //IF USER ID MISSING THAN RETURN 
      if (!userId) {
        console.warn("❌ UserId missing during register");
        return;
      }

      socket.userId = userId;
      onlineUsers.set(userId, socket.id);

      // FRONTEND EXPECTS THIS ROOM
      socket.join(`user_${userId}`);
      socket.join(`notification_${userId}`)
      console.log(`User ${userId} registered`)
      console.log(`notification_${userId} registered`)

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
      // console.log("Sent unsent notifications:", notifyData.length);
    } catch (err) {
      console.error("Register error:", err);
    }
  });

  // socket.on("clearPopupNotifications", ({ userId }) => {
  //   if (!userId) return;

  //   io.to(`user_${userId}`).emit("removePopupNotifications");
  //   console.log(`✅ Popup notifications cleared for user ${userId}`);
  // });

  /* ---------------- FRONTEND SUPPORT EVENT ---------------- */
  // socket.on("registerUser", ({ userId }) => {
  //   socket.join(`user_${userId}`);
  // });

  /* ---------------- NOTIFICATIONS OLD CODE WORKING -ISSUE WITH THIS COD - ERROR MAX LISTNER--------------- */
  // socket.on("sendNotification", ({ toUserId, message }) => {
  //   io.to(`notification_${toUserId}`).emit("receiveNotification", { message });
  //   // console.log(`🔔 Notification sent to ${toUserId}`);
  // });
  /*------------------- NOTIFICATION NEW WRROR HANDLE MAX LISNER ---------*/
  socket.on("sendNotification", async ({ toUserId, message }) => {
    try {
      if (!toUserId) return;
      io.to(`notification_${toUserId}`).emit("receiveNotification", { message });
      console.log(`🔔 Notification sent to ${toUserId}`);
    } catch (err) {
      console.error("sendNotification error:", err);
    }
  });

  /* ---------------- CHAT ROOMS ---------------- */
  socket.on("joinRoom", (conversationId) => {
    socket.join(conversationId); // DO NOT CHANGE
    console.log(`Joined room ${conversationId}`);
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
      // console.log("❌ INVALID READ EVENT", { messageId, conversationId, role });
      return;
    }

    const payload = {
      messageId,
      conversationId,
      readbyinfluencer: Number(role) === 1,
      readbyvendor: Number(role) === 2,
    };
    // console.log("📡 EMIT updateMessageStatus", payload);

    io.to(String(conversationId)).emit("updateMessageStatus", payload);
  });

  /* ---------------- TICKET ROOMS ---------------- */
  socket.on("joinTicketRoom", (ticketId) => {
    socket.join(`ticket_${ticketId}`);
    console.log(`Joined ticket_${ticketId}`);
  });

  socket.on("leaveTicketRoom", (ticketId) => {
    socket.leave(`ticket_${ticketId}`);
  });

  /* ---------------- DISCONNECT ---------------- */
  socket.on("disconnect", () => {
    if (socket.userId) {
      socketDisconnectCount++;
      lastActivity = Date.now();
      console.log("Socket disconnected:", socket.id);
      onlineUsers.delete(socket.userId);

      socket.broadcast.emit("user-offline", {
        userId: socket.userId,
        lastSeen: new Date(),
      });

      console.log(`User ${socket.userId} disconnected`);
    }
  });
});
//Get Time 
// function getIdleTime() {
//   const now = Date.now();
//   const idleMs = now - lastActivity;
//   const idleSec = Math.floor(idleMs / 1000);
//   return idleSec;
// }
// Log For Req And Res
// setInterval(() => {
//   console.log("-------Last 10 Second-----")
//   console.log("Get Request : - ", getCount);
//   console.log("Post Count : -", postCount)
//   console.log("Socket Connected Count :-", socketConnectCount)
//   console.log("socekt Disconnected Count :-", socketDisconnectCount)
//   console.log("App Idle Time:", getIdleTime(), "seconds");
// }, 10000);

// function getIdleTime() {
//   const now = Date.now();
//   const idleMs = now - lastActivity;
//   const idleSec = Math.floor(idleMs / 1000);
//   return idleSec;
// }
// setInterval(() => {
//   console.log("-------Last 10 Second-----")
//   console.log("Get Request : - ", getCount);
//   console.log("Post Count : -", postCount)
//   console.log("Socket Connected Count :-",socketConnectCount)
//   console.log("socekt Disconnected Count :-",socketDisconnectCount)
//   console.log("App Idle Time:", getIdleTime(), "seconds");
// }, 10000);

// setInterval(() => {
//   console.log("🔄 Resetting request counters (5 minutes passed)");
//   getCount = 0;
//   postCount = 0;
//   socketConnectCount=0;
//   socketDisconnectCount=0;
// }, 300000); // 5 min


// Start server using HTTP server
server.listen(PORT, () => {
  console.log("Server started on port", PORT);
});