const express = require('express');
const routes = express.Router();
const VendorController = require('../controller/VendorController');

routes.post('/login', VendorController.loginVendor);

routes.post('/register', VendorController.requestRegistration)

routes.post('/verify-otp', VendorController.verifyOtpAndRegister);

routes.post('/resend-otp', VendorController.resendOtp);

routes.post('/forgot-password', VendorController.forgetPassword);

routes.post('/reset-password', VendorController.resetPassword);

module.exports = routes;