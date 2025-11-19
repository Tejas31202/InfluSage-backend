import { client } from '../../config/Db.js';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { sendingMail } from '../../utils/MailUtils.js';
import { htmlContent } from '../../utils/EmailTemplates.js';
import { redisClient } from "../../config/redis.js";

const JWT_SECRET = process.env.JWT_SECRET;

// Utility: Check if email exists using stored procedure
async function isEmailExists(email) {
  const result = await client.query(
    `CALL ins.usp_is_registered($1::VARCHAR,NULL,NULL)`,
    [email]
  );
  const isUserExists = result.rows[0].p_isregistered;
  return isUserExists;
}

// Utility: Generate OTP
function generateOTP() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// Step 1: Request Registration (send OTP, store data in Redis)
export const requestRegistration = async (req, res) => {
  try {
    // console.log("Setting pendingUser in Redis:", normalizedEmail);
    const keys = await redisClient.keys("*");
    // console.log("Redis keys after registration:", keys);

    const { firstName, lastName, email, roleId, password } = req.body;
    const normalizedEmail = email.toLowerCase();

    if (await isEmailExists(normalizedEmail)) {
      return res
        .status(400)
        .json({ message: "User with this email already exists." });
    }

    const passwordhash = await bcrypt.hash(password, 10);

    // Generate OTP once only
    const otpCode = generateOTP();

    // ✅ Ab wahi OTP har jagah use hoga
    // console.log("Generated OTP (for registration):", otpCode);

    // Store user data in Redis (5 minutes expiry)
    await redisClient.set(
    `pendingUser:${normalizedEmail}`,
    ({
    firstName,
    lastName,
    email: normalizedEmail,
    roleId,
    passwordhash,
    }),
    { ex: 300 }
    );


    // Store OTP in Redis (2 minutes expiry)
    await redisClient.set(`otp:${normalizedEmail}`, otpCode, { ex: 60 });

    // Send OTP email

    await sendingMail(normalizedEmail, "InflueSage OTP Verification",htmlContent({otp:otpCode}));


    res.status(200).json({
      message: "OTP sent to email. Complete verification to register.",
    });
  } catch (error) {
    console.error("Request Registration Error:", error);
    res.status(500).json({ message: "Error during registration request." });
  }
};

// Step 2: Verify OTP and Register User
export const verifyOtpAndRegister = async (req, res) => {
  const email = req.body.email.toLowerCase(); // normalize email
  const { otp } = req.body;

  try {
    
    const storedOtp = await redisClient.get(`otp:${email}`);
    // console.log(" OTP stored in Redis:", storedOtp);

    if (!storedOtp) {
      return res.status(400).json({ message: "OTP expired or not found." });
    }
    console.log(" Comparing OTPs:", storedOtp, otp);
    if (storedOtp !== otp) {
      console.log(" OTP mismatch!");
      return res.status(400).json({ message: "Invalid OTP." });
    }
    // console.log(" OTP matched successfully!");

    // Check pending user
    const userDataStr = await redisClient.get(`pendingUser:${email}`);
    // console.log(" pendingUser data from Redis:", userDataStr);

    if (!userDataStr) {
      return res
        .status(400)
        .json({ message: "No pending registration found." });
    }

    const { firstName, lastName, roleId, passwordhash } =
      (userDataStr);

    // Insert user into DB
    const result = await client.query(
      `CALL ins.usp_insert_user($1::VARCHAR, $2::VARCHAR, $3::VARCHAR, $4::VARCHAR, $5::BOOLEAN, $6::SMALLINT, NULL, NULL, NULL)`,
      [firstName, lastName, email, passwordhash, true, roleId]
    );

    const { p_code, p_message } = result.rows[0];

    // Clean up Redis
    await redisClient.del(`otp:${email}`);
    await redisClient.del(`pendingUser:${email}`);
  
    return res.status(p_code).json({ message: p_message });
  } catch (error) {
    console.error(" OTP Verification & Registration Error:", error);
    res
      .status(500)
      .json({ message: "Error verifying OTP or registering user." });
  }
};

// This function is used to login a user
export const loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await client.query(
      "CALL ins.usp_login_user($1::VARCHAR, $2::JSON, $3::BOOLEAN, $4::TEXT);",
      [email, null, null, null]
    );

    const dbResponse = result.rows[0];
    const user = dbResponse.p_loginuser;
    const p_status = dbResponse.p_status;
    const p_message = dbResponse.p_message;

    if (!user || user.code === "NOTREGISTERED") {
      return res.status(404).json({
        message: user?.message,
        code: user?.code,
      });
    }

    if (!user.passwordhash) {
      return res.status(404).json({
        message: "In DB response, passwordhash field is missing or null",
      });
    }
    // If DB says login failed
    if (!p_status) {
      return res.status(400).json({ message: p_message });
    }

    // Compare entered password with hashed password
    const isMatch = await bcrypt.compare(password, user.passwordhash);

    if (!isMatch) {
      return res.status(401).json({ message: "Incorrect password" });
    }

    //Generate JWT token
    const token = jwt.sign(
      {
        id: user.userid,
        email: email,
        role: user.roleid,
        name: user.fullname,
        p_code:user.code
      },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    // Success response
    return res.status(200).json({
      message: "Welcome back " + user.fullname,
      token, // ← send to frontend
      id: user.userid,
      name: user.fullname,
      email: email,
      role: user.roleid,
      p_code: user.code,
      p_message: user.message,
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Server error during login" });
  }
};

// This function is used to resend OTP to the user's email
export const resendOtp = async (req, res) => {
  const email = req.body.email.toLowerCase();

  try {
    //For Previous Otp Expire
    await redisClient.del(`otp:${email}`);
    // Generate OTP once only
    const otpCode = generateOTP();

    // Send Email with OTP

    await sendingMail(email, "InflueSage OTP Verification - Resend",htmlContent({otp:otpCode}));

    // Store OTP in Redis with 120 sec expiry
    await redisClient.set(`otp:${email}`, otpCode, { ex: 120 });

    // Reset pendingUser TTL if user exists
    const userData = await redisClient.get(`pendingUser:${email}`);
    if (userData) {
      await redisClient.expire(`pendingUser:${email}`, 300);
      // console.log("Pending user TTL reset for:", email);
    }

    return res.status(200).json({ message: "OTP resent successfully." });
  } catch (error) {
    console.error("Resend OTP Error:", error);
    return res.status(500).json({ message: "Error resending OTP." });
  }
};

// this function is used to reset the password of a user
export const forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    // Check if user exists
    const isUserExists = await isEmailExists(email);
    if (!isUserExists) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = await client.query(
      "SELECT * FROM ins.fn_get_loginpassword($1::VARCHAR)",
      [email]
    );

    const userId = user.rows[0].userid;

    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

    await redisClient.set(`reset:${resetToken}`, userId, { ex: 300 });

    // Send Email with reset url
    await sendingMail(
      email,
      "InflueSage Password Reset",
      `Click to reset your password: ${resetUrl}`
    );

    return res.status(200).json({ message: "Reset link sent to email." });
  } catch (error) {
    console.error("Forget Password Error:", error);
    return res
      .status(500)
      .json({ message: "Error initiating password reset." });
  }
};

export const resetPassword = async (req, res) => {
  const { token, password } = req.body;
  try {
    // Get email from Redis using token
    const userId = await redisClient.get(`reset:${token}`);
    if (!userId) {
      return res
        .status(400)
        .json({ message: "Invalid or expired reset token." });
    }

    // Hash new password
    const passwordhash = await bcrypt.hash(password, 10);

    // Update password in DB (adjust query as per your DB)
    const updateResult = await client.query(
      `CALL ins.usp_reset_userpassword($1::BIGINT, $2::VARCHAR, NULL, NULL)`,
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
    console.error("Reset Password Error:", error);
    return res.status(500).json({ message: "Error resetting password." });
  }
};
