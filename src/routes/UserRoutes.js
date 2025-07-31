const express = require('express');
const routes = express.Router();
const UserController = require('../controller/UserController');

// Route: POST /api/login
routes.post('/login', UserController.loginUser);

routes.post('/register', UserController.requestRegistration)

routes.post('/verify-otp', UserController.verifyOtpAndRegister);

routes.post('/resend-otp', UserController.resendOtp);

routes.post('/forgot-password', UserController.forgetPassword);

routes.post('/reset-password', UserController.resetPassword);


module.exports = routes;

