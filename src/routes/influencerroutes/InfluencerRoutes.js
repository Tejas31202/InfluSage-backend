import express from 'express';
import {
  loginUser,
  requestRegistration,
  verifyOtpAndRegister,
  resendOtp,
  forgotPassword,
  resetPassword,
} from '../../controller/influencercontroller/InfluencerController.js';

const routes = express.Router();

routes.post("/login", loginUser);
routes.post("/register", requestRegistration);
routes.post("/verify-otp", verifyOtpAndRegister);
routes.post("/resend-otp", resendOtp);
routes.post("/forgot-password", forgotPassword);
routes.post("/reset-password", resetPassword);

export default routes;
