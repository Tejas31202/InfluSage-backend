import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from 'path';
// import session from 'express-session';
// import passport from "passport";
// // import indexRoutes from './src/routes/index.js'
// import authRoutes from './src/routes/authRoutes.js'
// import './src/config/Passport.js';
// import 'dotenv/config'; //  Must be the first import



//Changes For Apple Id Login
// import session from 'express-session';
// import passport from "passport";
// import './src/config/Passport.js'
// import router from './src/routes/AuthRoutes.js'
//Changes Above For Apple Id Login
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

dotenv.config();

const app = express();

// Middleware
app.use(express.json());

//Changes For Apple ID Login 

// app.use(session({
//   secret: process.env.SESSION_SECRET,
//   resave: false,
//   saveUninitialized: false
// }));

// app.use(passport.initialize());
// app.use(passport.session());

// app.use('/auth', router);

// app.get('/', (req, res) => {
//   res.send('✅ Apple Sign-In Backend Running');
// });


//Changes For AppleId Login Above

app.use("/src/uploads", express.static(path.join(process.cwd(), "src/uploads")));
app.use(express.urlencoded({ extended: true }));
app.use(cors());
dotenv.config(); // if app in src


app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false, // only save when session changes
  })
);

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Routes
// app.use('/', indexRoutes);
app.use('/auth', authRoutes);

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