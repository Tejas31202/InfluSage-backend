import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import { Server } from 'socket.io';

import authRoutes from './src/routes/AuthRoutes.js';
import InfluencerRoutes from './src/routes/influencerroutes/InfluencerRoutes.js';
import InfluencerProfileDetailRoutes from './src/routes/influencerroutes/InfluencerProfileDetailRoutes.js';
import VendorRoutes from './src/routes/vendorroutes/VendorRoute.js';
import VendorProfileDetailRoutes from './src/routes/vendorroutes/VendorProfileDetailRoutes.js';
import VendorCampaignRoutes from './src/routes/vendorroutes/VendorCampaignRoutes.js';
import InfluencerCampaignRoutes from './src/routes/influencerroutes/InfluencerCampaignRoutes.js';
import VendorBrowseInfluencerRoutes from './src/routes/vendorroutes/VendorBrowseInfluencerRoutes.js';
import VendorOffersRoutes from './src/routes/vendorroutes/VendorOffersRoutes.js';
import CommonRoutes from './src/routes/CommonRoutes.js';
import ChatRoutes from './src/routes/ChatRoutes.js';
import VendorMyCampaignRoutes from './src/routes/vendorroutes/VendorMyCampaignRoutes.js';
import InfluencerMyCampaignRoutes from './src/routes/influencerroutes/InfluencerMyCampaignRoutes.js';
import { sessionMiddleware } from './src/middleware/SessionMiddleware.js';

dotenv.config();
const app = express();

// --------------------
// CORS must come BEFORE session middleware
// --------------------
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true, // <- needed for cookies/session
  methods: ["GET","POST","PUT","DELETE","OPTIONS"]
}));

// --------------------
// Body parsers & cookie
// --------------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// --------------------
// Session middleware
// --------------------
app.use(sessionMiddleware);

// --------------------
// Static uploads
// --------------------
app.use("/src/uploads", express.static(path.join(process.cwd(), "src/uploads")));

// --------------------
// Test routes
// --------------------
app.post('/test', async (req, res) => {
  console.log('Body:', req.body);
  res.status(200).json({ message: 'POST working!' });
});

app.get('/test-session', (req, res) => {
  if (!req.session.views) req.session.views = 1;
  else req.session.views++;

  console.log("Session ID =>", req.sessionID);
  console.log("Session object =>", req.session);

  res.json({
    message: "Session test",
    sessionID: req.sessionID,
    views: req.session.views,
  });
});

// --------------------
// Routes
// --------------------
app.use("/auth", authRoutes);
app.use("/", CommonRoutes);
app.use("/user", InfluencerRoutes);
app.use("/user", InfluencerProfileDetailRoutes);
app.use("/user", InfluencerCampaignRoutes);
app.use("/user", InfluencerMyCampaignRoutes);
app.use("/vendor", VendorRoutes);
app.use("/vendor", VendorProfileDetailRoutes);
app.use("/vendor", VendorCampaignRoutes);
app.use("/vendor", VendorBrowseInfluencerRoutes);
app.use("/vendor", VendorOffersRoutes);
app.use("/vendor", VendorMyCampaignRoutes);
app.use("/chat", ChatRoutes);

// --------------------
// Server + Socket.IO
// --------------------
const PORT = process.env.BACKEND_PORT || 3001;
const server = createServer(app);
const onlineUsers = new Map();

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
    methods: ["GET","POST","PUT","DELETE","OPTIONS"]
  },
});

io.on("connection", (socket) => {
  console.log("🔗 User connected:", socket.id);

  socket.on("register", (userId) => {
    onlineUsers.set(userId, socket.id);
    socket.userId = userId;
    socket.broadcast.emit("user-online", { userId });
    socket.emit("online-users", { userIds: [...onlineUsers.keys()] });
  });

  socket.on("joinRoom", (conversationId) => socket.join(conversationId));
  socket.on("leaveRoom", (conversationId) => socket.leave(conversationId));

  socket.on("deleteMessage", ({ messageId, conversationId }) =>
    io.to(conversationId).emit("deleteMessage", messageId)
  );

  socket.on("undoDeleteMessage", ({ messageId, conversationId }) =>
    io.to(conversationId).emit("undoDeleteMessage", messageId)
  );

  socket.on("sendMessage", (message) => {
    const { conversationId } = message;
    socket.to(conversationId).emit("receiveMessage", message);
  });

  socket.on("disconnect", () => {
    const userId = socket.userId;
    if (userId) {
      onlineUsers.delete(userId);
      socket.broadcast.emit("user-offline", { userId, lastSeen: new Date() });
    }
  });

  socket.on("messageRead", ({ messageId, conversationId, role }) =>
    io.to(`conversation_${conversationId}`).emit("updateMessageStatus", {
      messageId,
      readbyvendor: role === 1 ? true : undefined,
      readbyinfluencer: role === 2 ? true : undefined,
    })
  );
});

// --------------------
// Start server
// --------------------
server.listen(PORT, () => {
  console.log("Server started on port", PORT);
});
