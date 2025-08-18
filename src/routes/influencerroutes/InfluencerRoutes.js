import express from 'express';
import { 
  loginUser, 
  requestRegistration, 
  verifyOtpAndRegister, 
  resendOtp, 
  forgetPassword, 
  resetPassword 
} from '../../controller/influencercontroller/InfluencerController.js';

const routes = express.Router();

// Route: POST /api/login
routes.post('/login', loginUser);
routes.post('/register', requestRegistration);
routes.post('/verify-otp', verifyOtpAndRegister);
routes.post('/resend-otp', resendOtp);
routes.post('/forgot-password', forgetPassword);
routes.post('/reset-password', resetPassword);

export default routes;
