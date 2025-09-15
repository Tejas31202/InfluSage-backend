
import { client } from '../../config/Db.js';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import sendingMail from '../../utils/MailUtils.js';
import redis from 'redis';

const redisClient = redis.createClient({ url: process.env.REDIS_URL });
redisClient.connect().catch(console.error);

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
    console.log("Redis keys after registration:", keys);

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
    console.log("Generated OTP (for registration):", otpCode);

    // Store user data in Redis (5 minutes expiry)
    await redisClient.setEx(
      `pendingUser:${normalizedEmail}`,
      300,
      JSON.stringify({
        firstName,
        lastName,
        email: normalizedEmail,
        roleId,
        passwordhash,
      })
    );

    // Store OTP in Redis (2 minutes expiry)
    await redisClient.setEx(`otp:${normalizedEmail}`, 300, otpCode);

    // Send OTP email
    await sendingMail(normalizedEmail, "InflueSage OTP Verification", otpCode);

    res
      .status(200)
      .json({
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
    // 🔍 Debug logs
    console.log(" Verifying OTP for:", email);
    console.log(" OTP received from user:", otp);

    const storedOtp = await redisClient.get(`otp:${email}`);
    console.log(" OTP stored in Redis:", storedOtp);

    if (!storedOtp) {
      return res.status(400).json({ message: "OTP expired or not found." });
    }
    if (storedOtp !== otp) {
      console.log(" OTP mismatch!");
      return res.status(400).json({ message: "Invalid OTP." });
    }
    console.log(" OTP matched successfully!");

    // Check pending user
    const userDataStr = await redisClient.get(`pendingUser:${email}`);
    console.log(" pendingUser data from Redis:", userDataStr);

    if (!userDataStr) {
      return res
        .status(400)
        .json({ message: "No pending registration found." });
    }

    const { firstName, lastName, roleId, passwordhash } =
      JSON.parse(userDataStr);

    // Insert user into DB
    const result = await client.query(
      `CALL ins.usp_insert_user($1::VARCHAR, $2::VARCHAR, $3::VARCHAR, $4::VARCHAR, $5::BOOLEAN, $6::SMALLINT, NULL, NULL, NULL)`,
      [firstName, lastName, email, passwordhash, true, roleId]
    );

    const { p_code, p_message } = result.rows[0];
    console.log(" DB Response:", { p_code, p_message });

    // Clean up Redis
    await redisClient.del(`otp:${email}`);
    await redisClient.del(`pendingUser:${email}`);
    console.log(" Redis keys deleted for:", email);

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
    // Check if user exists
    const isUserExists = await isEmailExists(email);
    if (!isUserExists) {
      return res.status(401).json({ message: "User not found" });
    }

    const userPasswordResult = await client.query(
      "SELECT * FROM ins.fn_get_loginpassword($1::VARCHAR)",
      [email]
    );

    const { passwordhash, roleid, userid, firstname, lastname } =
      userPasswordResult.rows[0];

    // Compare entered password with hashed password
    const isMatch = await bcrypt.compare(password, passwordhash);

    if (!isMatch) {
      return res.status(401).json({ message: "Incorrect password" });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        id: userid,
        email: email,
        role: roleid,
        name: `${firstname}_${lastname}`,
      },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    // Success response
    return res.status(200).json({
      message: "Welcome back " + firstname + " " + lastname,
      token, // ← send to frontend
      id: userid,
      firstName: firstname,
      lastName: lastname,
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
export const resendOtp = async (req, res) => {
  const email = req.body.email.toLowerCase();

  try {
    // Generate OTP once only
    const otpCode = generateOTP();

    //  Yehi OTP sab jagah use hoga
    console.log("Generated OTP:", otpCode);

    // Send Email with OTP
    await sendingMail(email, "InflueSage OTP Verification - Resend", otpCode);

    // Store OTP in Redis with 120 sec expiry
    await redisClient.setEx(`otp:${email}`, 120, otpCode);

    // Reset pendingUser TTL if user exists
    const userData = await redisClient.get(`pendingUser:${email}`);
    if (userData) {
      await redisClient.expire(`pendingUser:${email}`, 300);
      console.log("Pending user TTL reset for:", email);
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

    await redisClient.setEx(`reset:${resetToken}`, 300, userId);

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
