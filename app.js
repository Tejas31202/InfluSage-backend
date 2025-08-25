import express from "express";
import cors from "cors";
import dotenv from "dotenv";
// import session from "express-session";
// import passport from "passport";
// import { client } from './src/config/db.js';
// import authenticateUser from './src/middleware/AuthMiddleware.js';
import InfluencerRoutes from "./src/routes/influencerroutes/InfluencerRoutes.js";
import InfluencerProfileDetailRoutes from "./src/routes/influencerroutes/InfluencerProfileDetailRoutes.js";
import VendorRoutes from "./src/routes/vendorroutes/VendorRoute.js";
import VendorProfileDetailRoutes from "./src/routes/vendorroutes/VendorProfileDetailRoutes.js";
import VendorCampaignRoutes from "./src/routes/vendorroutes/VendorCampaignRoutes.js";
import InfluencerCampaignRoutes from "./src/routes/influencerroutes/InfluencerCampaignRoutes.js"
// import "./src/config/Passport.js";
// import { config } from "@dotenvx/dotenvx";

const app = express();

// Middleware
app.use(express.json());
app.use(cors());
dotenv.config(); // if app in src

// app.use(session({
//   secret: process.env.SESSION_SECRET,
//   resave: false,
//   saveUninitialized: true,
// }));

// app.use(passport.initialize());
// app.use(passport.session());

// Routes
// app.use("/auth", AuthRoutes);

// Routes
// const RoleRoutes = require("../InfluSaga/src/routes/RoleRoutes")
// app.use('/roles', RoleRoutes);

//here overlapping issue so name changes require in path
app.use('/user', InfluencerRoutes);
app.use('/user', InfluencerProfileDetailRoutes);
app.use('/user', InfluencerCampaignRoutes);
app.use('/vendor', VendorRoutes);
app.use('/vendor', VendorProfileDetailRoutes);
app.use('/vendor', VendorCampaignRoutes);
// app.use('/auth', AuthRoutes);

const PORT =  process.env.BACKEND_PORT || 3001;

app.listen(PORT, () => {
    console.log("server started on", PORT);
});