import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { client } from './src/config/db.js';
import authenticateUser from './src/middleware/AuthMiddleware.js';
import InfluencerRoutes from "./src/routes/influencerroutes/InfluencerRoutes.js";
import InfluencerProfileDetailController from "./src/routes/influencerroutes/InfluencerProfileDetailRoutes.js";
import VendorRoutes from "./src/routes/vendorroutes/VendorRoute.js";
import VendorProfileDetailController from "./src/routes/vendorroutes/VendorProfileDetailRoutes.js";
import { config } from "@dotenvx/dotenvx";

const app = express();

// Middleware
app.use(express.json());
app.use(cors());
dotenv.config(); // if app in src

// Routes
// const RoleRoutes = require("../InfluSaga/src/routes/RoleRoutes")
// app.use('/roles', RoleRoutes);

app.use('/user', InfluencerRoutes);
app.use('/user', InfluencerProfileDetailController);
app.use('/vendor', VendorRoutes);
app.use('/vendor', VendorProfileDetailController);

const PORT =  process.env.BACKEND_PORT || 3001;

app.listen(PORT, () => {
    console.log("server started on", PORT);
});