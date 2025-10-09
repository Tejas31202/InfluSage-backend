import { client } from '../../config/Db.js';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import redisClient from '../../config/redis.js';
import { Resend } from 'resend';
import dotenv from 'dotenv';
dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);
const JWT_SECRET = process.env.JWT_SECRET;

// Utility: Check if email exists using stored procedure
async function isEmailExists(email) {
  const result = await client.query(
    `CALL ins.usp_is_registered($1::VARCHAR,NULL,NULL)`,
    [email]
  );
  return result.rows[0].p_isregistered;
}

// Utility: Generate OTP
function generateOTP() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// Utility: Send email via Resend API
async function sendingMail(to, subject, htmlContent, from = "InfluSage <no-reply@influSage.com>") {
  try {
    const response = await resend.emails.send({
      from,
      to,
      subject,
      html: htmlContent,
    });
    console.log("✅ Mail sent successfully:", response.id);
  } catch (error) {
    console.error("❌ Mail sending failed:", error);
    throw new Error("Failed to send email");
  }
}

// ==================== Registration ====================

// Step 1: Request Registration (send OTP, store data in Redis)
export const requestRegistration = async (req, res) => {
  try {
    const { firstName, lastName, email, roleId, password } = req.body;
    const normalizedEmail = email.toLowerCase();

    if (await isEmailExists(normalizedEmail)) {
      return res.status(400).json({ message: "User with this email already exists." });
    }

    const passwordhash = await bcrypt.hash(password, 10);
    const otpCode = generateOTP();

    // Store user data in Redis (5 minutes)
    await redisClient.setEx(
      `pendingUser:${normalizedEmail}`,
      300,
      JSON.stringify({ firstName, lastName, email: normalizedEmail, roleId, passwordhash })
    );

    // Store OTP in Redis (5 minutes)
    await redisClient.setEx(`otp:${normalizedEmail}`, 300, otpCode);

    // Send OTP email
    await sendingMail(
      normalizedEmail,
      "InfluSage OTP Verification",
      `<h3>InfluSage Verification Code</h3>
       <p>Your OTP is: <strong style="font-size:24px;">${otpCode}</strong></p>
       <p>This code will expire in 10 minutes.</p>`
    );

    return res.status(200).json({ message: "OTP sent to email. Complete verification to register." });
  } catch (error) {
    console.error("Request Registration Error:", error);
    return res.status(500).json({ message: "Error during registration request." });
  }
};

// Step 2: Verify OTP and Register User
export const verifyOtpAndRegister = async (req, res) => {
  try {
    const email = req.body.email.toLowerCase();
    const { otp } = req.body;

    const storedOtp = await redisClient.get(`otp:${email}`);
    if (!storedOtp) return res.status(400).json({ message: "OTP expired or not found." });
    if (storedOtp !== otp) return res.status(400).json({ message: "Invalid OTP." });

    const userDataStr = await redisClient.get(`pendingUser:${email}`);
    if (!userDataStr) return res.status(400).json({ message: "No pending registration found." });

    const { firstName, lastName, roleId, passwordhash } = JSON.parse(userDataStr);

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
    console.error("OTP Verification & Registration Error:", error);
    return res.status(500).json({ message: "Error verifying OTP or registering user." });
  }
};

// ==================== Login ====================
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    const isUserExists = await isEmailExists(email);
    if (!isUserExists) return res.status(401).json({ message: "User not found" });

    const userPasswordResult = await client.query(
      "SELECT * FROM ins.fn_get_loginpassword($1::VARCHAR)",
      [email]
    );
    const { passwordhash, roleid, userid, firstname, lastname } = userPasswordResult.rows[0];

    const isMatch = await bcrypt.compare(password, passwordhash);
    if (!isMatch) return res.status(401).json({ message: "Incorrect password" });

    const token = jwt.sign({ id: userid, email, role: roleid, name: `${firstname}_${lastname}` }, JWT_SECRET, { expiresIn: "1h" });

    return res.status(200).json({
      message: `Welcome back ${firstname} ${lastname}`,
      token,
      id: userid,
      firstName: firstname,
      lastName: lastname,
      name: `${firstname} ${lastname}`,
      email,
      role: roleid,
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Server error during login" });
  }
};

// ==================== Resend OTP ====================
export const resendOtp = async (req, res) => {
  try {
    const email = req.body.email.toLowerCase();
    const otpCode = generateOTP();

    await sendingMail(
      email,
      "InfluSage OTP Verification - Resend",
      `<h3>InfluSage Verification Code</h3>
       <p>Your OTP is: <strong style="font-size:24px;">${otpCode}</strong></p>
       <p>This code will expire in 2 minutes.</p>`
    );

    // Store OTP in Redis with 2 min expiry
    await redisClient.setEx(`otp:${email}`, 120, otpCode);

    // Reset pendingUser TTL if exists
    const userData = await redisClient.get(`pendingUser:${email}`);
    if (userData) await redisClient.expire(`pendingUser:${email}`, 300);

    return res.status(200).json({ message: "OTP resent successfully." });
  } catch (error) {
    console.error("Resend OTP Error:", error);
    return res.status(500).json({ message: "Error resending OTP." });
  }
};

// ==================== Forgot Password ====================
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const isUserExists = await isEmailExists(email);
    if (!isUserExists) return res.status(404).json({ message: "User not found" });

    const user = await client.query("SELECT * FROM ins.fn_get_loginpassword($1::VARCHAR)", [email]);
    const userId = user.rows[0].userid;
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

    await redisClient.setEx(`reset:${resetToken}`, 300, userId);

    await sendingMail(
      email,
      "InfluSage Password Reset",
      `<h3>Password Reset Request</h3>
       <p>Click the link below to reset your password:</p>
       <a href="${resetUrl}">Reset Password</a>
       <p>This link will expire in 5 minutes.</p>`
    );

    return res.status(200).json({ message: "Reset link sent to email." });
  } catch (error) {
    console.error("Forget Password Error:", error);
    return res.status(500).json({ message: "Error initiating password reset." });
  }
};

// ==================== Reset Password ====================
export const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    const userId = await redisClient.get(`reset:${token}`);
    if (!userId) return res.status(400).json({ message: "Invalid or expired reset token." });

    const passwordhash = await bcrypt.hash(password, 10);

    const updateResult = await client.query(
      `CALL ins.usp_reset_userpassword($1::BIGINT, $2::VARCHAR, NULL, NULL)`,
      [userId, passwordhash]
    );

    const { p_status, p_message } = updateResult.rows[0];

    await redisClient.del(`reset:${token}`);

    if (p_status) return res.status(200).json({ message: p_message });
    else return res.status(400).json({ message: p_message });
  } catch (error) {
    console.error("Reset Password Error:", error);
    return res.status(500).json({ message: "Error resetting password." });
  }
};
