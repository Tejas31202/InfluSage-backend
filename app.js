import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from 'path';
//Changes For Apple Id Login
// import session from 'express-session';
// import passport from "passport";
// import AuthRoutes from './src/routes/AuthRoutes.js'
// import './src/config/Passport.js'
import InfluencerRoutes from "./src/routes/influencerroutes/InfluencerRoutes.js";
import InfluencerProfileDetailRoutes from "./src/routes/influencerroutes/InfluencerProfileDetailRoutes.js";
import VendorRoutes from "./src/routes/vendorroutes/VendorRoute.js";
import VendorProfileDetailRoutes from "./src/routes/vendorroutes/VendorProfileDetailRoutes.js";
import VendorCampaignRoutes from "./src/routes/vendorroutes/VendorCampaignRoutes.js";
import InfluencerCampaignRoutes from "./src/routes/influencerroutes/InfluencerCampaignRoutes.js"
// import "./src/config/Passport.js";
// import { config } from "@dotenvx/dotenvx";
// import session from "express-session";
// import { client } from './src/config/db.js';
// import authenticateUser from './src/middleware/AuthMiddleware.js';


const app = express();

// Middleware
app.use(express.json());
app.use("/src/uploads", express.static(path.join(process.cwd(), "src/uploads")));
app.use(express.urlencoded({ extended: true }));
app.use(cors());
dotenv.config(); // if app in src

//Changes For Apple Id Login

// app.use(session({
//   secret: process.env.SESSION_SECRET || 'defaultsecret',  // use your env secret
//   resave: false,
//   saveUninitialized: false,
//   cookie: {
//     secure: false, // if using HTTPS, set to true
//     maxAge: 24 * 60 * 60 * 1000 // 1 day, for example
//   }
// }));

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

// here overlapping issue so name changes require in path 

// app.use('/user', InfluencerRoutes);
// app.use('/user', InfluencerProfileDetailRoutes); if we changes thn working app.use('/user', InfluencerCampaignRoutes);

//Changes For Apple Id Login
// app.use(passport.initialize());
// app.use(passport.session());

// app.use('/api/auth', AuthRoutes);


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