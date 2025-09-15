import express from 'express';
import {
  getGoogleLoginPage,
  getGoogleLoginCallback,
  getFacebookLoginPage,
  getFacebookLoginCallback,
  setPasswordAfterGoogleSignup,
} from '../controller/AuthController.js';

const routes = express.Router();

// Google routes
routes.get("/google", getGoogleLoginPage);
routes.get("/google/callback", getGoogleLoginCallback);
routes.get("/facebook", getFacebookLoginPage);
routes.get("/facebook/callback", getFacebookLoginCallback);
routes.post("/set-password", setPasswordAfterGoogleSignup);

export default routes;
