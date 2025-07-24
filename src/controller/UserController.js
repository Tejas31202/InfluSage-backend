const client = require('../config/db');
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
exports.requestRegistration = async (req, res) => {
  const { firstName, lastName, email, roleId, password } = req.body;
  try {
    if (await isEmailExists(email)) {
      return res.status(400).json({ message: 'User with this email already exists.' });
    }

    const passwordhash = await bcrypt.hash(password, 10);
    const otpCode = generateOTP();

    // Store user data and hashed password in Redis for 50 seconds
    await redisClient.setEx(
      `pendingUser:${email}`,
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

// Step 2: Verify OTP and Register User
exports.verifyOtpAndRegister = async (req, res) => {
  const { email, otp } = req.body;
  try {
    const storedOtp = await redisClient.get(`otp:${email}`);
    if (!storedOtp) {
      return res.status(400).json({ message: "OTP expired or not found." });
    }
    if (storedOtp !== otp) {
      return res.status(400).json({ message: "Invalid OTP." });
    }

    const userDataStr = await redisClient.get(`pendingUser:${email}`);
    if (!userDataStr) {
      return res.status(400).json({ message: "No pending registration found." });
    }
    const { firstName, lastName, roleId, passwordhash } = JSON.parse(userDataStr);

    // Insert user into DB
    const result = await client.query(
      `CALL ins.sp_insert_user($1::VARCHAR, $2::VARCHAR, $3::VARCHAR, $4::VARCHAR, $5::BOOLEAN, $6::SMALLINT, NULL, NULL, NULL)`,
      [firstName, lastName, email, passwordhash, true, roleId]
    );

    const { p_code, p_message } = result.rows[0];

    // Clean up Redis
    await redisClient.del(`otp:${email}`);
    await redisClient.del(`pendingUser:${email}`);

    return res.status(p_code).json({ message: p_message });
  } catch (error) {
    console.error('OTP Verification & Registration Error:', error);
    res.status(500).json({ message: "Error verifying OTP or registering user." });
  }
};


// This function is used to login a user
exports.loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {

    // Check if user exists
    const isUserExists = await isEmailExists(email);
    if (!isUserExists) {
      return res.status(401).json({ message: "User not found" });
    }

    const userPasswordResult = await client.query(
      'SELECT * FROM ins.fn_get_loginpassword($1::VARCHAR)',
      [email]
    );

    const { passwordhash, roleid, userid, firstname, lastname } = userPasswordResult.rows[0];

    // Compare entered password with hashed password
    const isMatch = await bcrypt.compare(password, passwordhash);

    if (!isMatch) {
      return res.status(401).json({ message: "Incorrect password" });
    }


    // Generate JWT token
    const token = jwt.sign(
      { id: userid, email: email, role: roleid },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Success response
    return res.status(200).json({
      message: "Welcome back " + firstname + " " + lastname,
      token, // ← send to frontend
      id: userid,
      name: firstname + " " + lastname,
      email: email,
      role: roleid,
    });

  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Server error during login" });
  }
};


// This function is used to resend OTP to the user's email
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

    const userData = await redisClient.get(`pendingUser:${email}`);
    if (userData) {
      await redisClient.expire(`pendingUser:${email}`, 60); // Reset TTL to 60 seconds
    }

    return res.status(200).json({ message: "OTP resent successfully." });
  } catch (error) {
    console.error('Resend OTP Error:', error);
    return res.status(500).json({ message: "Error resending OTP." });
  }
};


// this fuctiion is used to reset the password of a user
exports.forgetPassword = async (req, res) => {
  const { email } = req.body;

  try {
    // Check if user exists
    const isUserExists = await isEmailExists(email);
    if (!isUserExists) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = await client.query(
      'SELECT * FROM ins.fn_get_loginpassword($1::VARCHAR)',
      [email]
    );

    const userId = user.rows[0].userid;


    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

    await redisClient.setEx(`reset:${resetToken}`, 300, userId);


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
    const userId = await redisClient.get(`reset:${token}`);
    if (!userId) {
      return res.status(400).json({ message: "Invalid or expired reset token." });
    }

    // Hash new password
    const passwordhash = await bcrypt.hash(password, 10);

    // Update password in DB (adjust query as per your DB)
    const updateResult = await client.query(
      `CALL ins.sp_reset_userpassword($1::BIGINT, $2::VARCHAR, NULL, NULL)`,
      [userId, passwordhash]
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




