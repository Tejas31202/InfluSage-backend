import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import authRoutes from './src/routes/AuthRoutes.js';
import cookieParser from 'cookie-parser';

import InfluencerRoutes from './src/routes/influencerroutes/InfluencerRoutes.js';
import InfluencerProfileDetailRoutes from './src/routes/influencerroutes/InfluencerProfileDetailRoutes.js';
import VendorRoutes from './src/routes/vendorroutes/VendorRoute.js';
import VendorProfileDetailRoutes from './src/routes/vendorroutes/VendorProfileDetailRoutes.js';
import VendorCampaignRoutes from './src/routes/vendorroutes/VendorCampaignRoutes.js';
import InfluencerCampaignRoutes from './src/routes/influencerroutes/InfluencerCampaignRoutes.js';
import VendorBrowseInfluencerRoutes from './src/routes/vendorroutes/VendorBrowseInfluencerRoutes.js';
import VendorOffersRoutes from './src/routes/vendorroutes/VendorOffersRoutes.js';
import CommonRoutes from './src/routes/CommonRoutes.js';
import { createServer } from 'http';
import { Server } from 'socket.io';
import ChatRoutes from './src/routes/ChatRoutes.js';

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
app.use("/vendor", VendorRoutes);
app.use("/vendor", VendorProfileDetailRoutes);
app.use("/vendor", VendorCampaignRoutes);
app.use("/vendor",VendorBrowseInfluencerRoutes);
app.use("/vendor",VendorOffersRoutes);
app.use("/chat", ChatRoutes);

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

// Socket.IO connection
io.on("connection", (socket) => {
  console.log("🔗 User connected:", socket.id);

   socket.on("register", (userId) => {
    onlineUsers.set(userId, socket.id);
    console.log(`User ${userId} registered with socket ${socket.id}`);
  });

 socket.on("disconnect", () => {
    for (let [userId, sId] of onlineUsers.entries()) {
      if (sId === socket.id) {
        onlineUsers.delete(userId);
        console.log(`User ${userId} disconnected`);
        break;
      }
    }
  });
});

// Start server using HTTP server
server.listen(PORT, () => {
  console.log("Server started on port", PORT);
});
