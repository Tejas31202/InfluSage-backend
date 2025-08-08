const {client} = require('../config/db');
const bcrypt = require("bcrypt");
const crypto = require('crypto');
const jwt = require("jsonwebtoken");
const sendingMail = require("../utils/MailUtils");
const redis = require('redis');
const redisClient = redis.createClient({ url: process.env.REDIS_URL });
redisClient.connect().catch(console.error);

const JWT_SECRET = process.env.JWT_SECRET;


// Utility: Check if email exists using stored procedure
async function isEmailExists(email) {
  const result = await client.query(`CALL ins.sp_is_registered($1::VARCHAR,NULL,NULL,NULL)`, [email]);
  isUserExists = result.rows[0].p_isregistered;
  return isUserExists;
}

// Utility: Generate OTP
function generateOTP() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// Step 1: Request Registration (send OTP, store data in Redis)
exports.  requestRegistration = async (req, res) => {
  const { firstName, lastName, email, roleId, password } = req.body;
  try {
    if (await isEmailExists(email)) {
      return res.status(400).json({ message: 'Verndor with this email already exists.' });
    }

    const passwordhash = await bcrypt.hash(password, 10);
    const otpCode = generateOTP();

    // Store vendor data and hashed password in Redis for 50 seconds
    await redisClient.setEx(
      `pendingVendor:${email}`,
      60, // Store for 60 seconds
      JSON.stringify({ firstName, lastName, email, roleId, passwordhash })
    );
    await redisClient.setEx(`otp:${email}`, 60, otpCode);

    await sendingMail(email, "InflueSage OTP Verification", otpCode);

    res.status(200).json({ message: 'OTP sent to email. Complete verification to register.' });
  } catch (error) {
    console.error('Request Registration Error:', error);
    res.status(500).json({ message: 'Error initiating registration.' });
  }
};

// Step 2: Verify OTP and Register vendor
exports. verifyOtpAndRegister = async (req, res) => {
  const { email, otp } = req.body;
  try {
    const storedOtp = await redisClient.get(`otp:${email}`);
    if (!storedOtp) {
      return res.status(400).json({ message: "OTP expired or not found." });
    }
    if (storedOtp !== otp) {
      return res.status(400).json({ message: "Invalid OTP." });
    }

    const vendorDataStr = await redisClient.get(`pandingVendor:${email}`);
    if (!vendorDataStr) {
      return res.status(400).json({ message: "No pending registration found." });
    }
    const { firstName, lastName, roleId, passwordhash } = JSON.parse(vendorDataStr);

    // Insert vendor into DB
    const result = await client.query(
      `CALL ins.sp_insert_user($1::VARCHAR, $2::VARCHAR, $3::VARCHAR, $4::VARCHAR, $5::BOOLEAN, $6::SMALLINT, NULL, NULL, NULL)`,
      [firstName, lastName, email, passwordhash, true, roleId]
    );

    const { p_code, p_message } = result.rows[0];

    // Clean up Redis
    await redisClient.del(`otp:${email}`);
    await redisClient.del(`pandingVendor:${email}`);

    return res.status(p_code).json({ message: p_message });
  } catch (error) {
    console.error('OTP Verification & Registration Error:', error);
    res.status(500).json({ message: "Error verifying OTP or registering vendor." });
  }
};


// This function is used to login a vendor
exports.loginVendor = async (req, res) => {
  const { email, password } = req.body;

  try {

    // Check if vendor exists
    const isVendorExists = await isEmailExists(email);
    if (!isVendorExists) {
      return res.status(401).json({ message: "vendor not found" });
    }

    const vendorPasswordResult = await client.query(
      'SELECT * FROM ins.fn_get_loginpassword($1::VARCHAR)',
      [email]
    );

    const { passwordhash, roleid, vendorid, firstname, lastname } = vendorPasswordResult.rows[0];

    // Compare entered password with hashed password
    const isMatch = await bcrypt.compare(password, passwordhash);

    if (!isMatch) {
      return res.status(401).json({ message: "Incorrect password" });
    }


    // Generate JWT token
    const token = jwt.sign(
      { id: vendorid, email: email, role: roleid },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Success response
    return res.status(200).json({
      message: "Welcome back " + firstname + " " + lastname,
      token, // ← send to frontend
      id: vendorid,
      name: firstname + " " + lastname,
      email: email,
      role: roleid,
    });

  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Server error during login" });
  }
};


// This function is used to resend OTP to the vendor's email
exports.resendOtp = async (req, res) => {
  const { email } = req.body;

  try {

    const otpCode = generateOTP();

    // Send Email with OTP
    await sendingMail(
      email,
      "InflueSage OTP Verification - Resend",
      otpCode
    );

    // Store OTP in Redis with 60 sec expiry
    await redisClient.setEx(`otp:${email}`, 60, otpCode);

    const vendorData = await redisClient.get(`pendingVendor:${email}`);
    if (vendorData) {
      await redisClient.expire(`pendingVendor:${email}`, 60); // Reset TTL to 60 seconds
    }

    return res.status(200).json({ message: "OTP resent successfully." });
  } catch (error) {
    console.error('Resend OTP Error:', error);
    return res.status(500).json({ message: "Error resending OTP." });
  }
};


// this fuctiion is used to reset the password of a vendor
exports.forgetPassword = async (req, res) => {
  const { email } = req.body;

  try {
    // Check if vendor exists
    const isVendorExists = await isEmailExists(email);
    if (!isVendorExists) {
      return res.status(404).json({ message: "vendor not found" });
    }

    const vendor = await client.query(
      'SELECT * FROM ins.fn_get_loginpassword($1::VARCHAR)',
      [email]
    );

    const vendorId = vendor.rows[0].vendorid;


    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

    await redisClient.setEx(`reset:${resetToken}`, 300, vendorId);


    // Send Email with reset url
    await sendingMail(
      email,
      "InflueSage Password Reset",
      `Click to reset your password: ${resetUrl}`
    );

    return res.status(200).json({ message: "Reset link sent to email." });
  } catch (error) {
    console.error('Forget Password Error:', error);
    return res.status(500).json({ message: "Error initiating password reset." });
  }
}


exports.resetPassword = async (req, res) => {


  const { token, password } = req.body;
  try {
    // Get email from Redis using token
    const vendorId = await redisClient.get(`reset:${token}`);
    if (!vendorId) {
      return res.status(400).json({ message: "Invalid or expired reset token." });
    }

    // Hash new password
    const passwordhash = await bcrypt.hash(password, 10);

    // Update password in DB (adjust query as per your DB)
    const updateResult = await client.query(
      `CALL ins.sp_reset_userpassword($1::BIGINT, $2::VARCHAR, NULL, NULL)`,
      [vendorId, passwordhash]
    );

    const { p_status, p_message } = updateResult.rows[0];
    // Remove token from Redis
    await redisClient.del(`reset:${token}`);

    if (p_status) {
      return res.status(200).json({ message: p_message });
    } else {
      return res.status(400).json({ message: p_message });
    }


  } catch (error) {
    console.error('Reset Password Error:', error);
    return res.status(500).json({ message: "Error resetting password." });
  }
}




