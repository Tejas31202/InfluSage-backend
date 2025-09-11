import express from "express";
import { getGoogleLoginPage, getGoogleLoginCallback, setPasswordAfterGoogleSignup } from "../controller/AuthController.js";

const 
routes = express.Router();

// Google routes
routes.get("/google", getGoogleLoginPage);
routes.get("/google/callback", getGoogleLoginCallback);
routes.post("/set-password", setPasswordAfterGoogleSignup);


// router.get("/facebook", getFacebookLoginPage);
// router.get("/facebook/callback", getFacebookLoginCallback);

export default routes;
