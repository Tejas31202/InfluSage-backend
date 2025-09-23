import express from 'express';
import {
  loginVendor,
  requestRegistration,
  verifyOtpAndRegister,
  resendOtp,
  forgotPassword,
  resetPassword,
} from '../../controller/vendorcontroller/VendorController.js';

const routes = express.Router();

routes.post("/login", loginVendor);
routes.post("/register", requestRegistration);
routes.post("/verify-otp", verifyOtpAndRegister);
routes.post("/resend-otp", resendOtp);
routes.post("/forgot-password", forgotPassword);
routes.post("/reset-password", resetPassword);

export default routes;
