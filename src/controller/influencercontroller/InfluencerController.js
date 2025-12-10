import { client } from '../../config/Db.js';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { sendingMail } from '../../utils/MailUtils.js';
import Redis from '../../utils/RedisWrapper.js';
import { htmlContent } from '../../utils/EmailTemplates.js';

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

// Step 1: Request Registration (send OTP, store data in Redis)
export const requestRegistration = async (req, res) => {
  try {
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

    await Redis.setEx(
      `pendingUser:${normalizedEmail}`,
      300,
      {
        firstName,
        lastName,
        email: normalizedEmail,
        roleId,
        passwordhash,
      }
    );

    await Redis.setEx(`otp:${normalizedEmail}`, 300, otpCode);

    // Send OTP email
    await sendingMail(
      normalizedEmail,
      "InflueSage OTP Verification",
      htmlContent({ otp: otpCode })
    );

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
  const email = req.body.email.toLowerCase();
  const { otp } = req.body;

  try {
    const storedOtp = await Redis.get(`otp:${email}`);

    if (!storedOtp) {
      return res.status(400).json({ message: "OTP expired or not found." });
    }
    console.log(" Comparing OTPs:", storedOtp, otp);
    if (Number(storedOtp) !== Number(otp)) {
    console.log("OTP mismatch!");
    return res.status(400).json({ message: "Invalid OTP." });
    }

    // Check pending user
    const pendingUser = await Redis.get(`pendingUser:${email}`);

    if (!pendingUser) {
      return res
        .status(400)
        .json({ message: "No pending registration found." });
    }

    const { firstName, lastName, roleId, passwordhash } = pendingUser;

    // Insert user into DB
    const result = await client.query(
      `CALL ins.usp_insert_user($1::VARCHAR, $2::VARCHAR, $3::VARCHAR, $4::VARCHAR, $5::BOOLEAN, $6::SMALLINT, NULL, NULL)`,
      [firstName, lastName, email, passwordhash, true, roleId]
    );

    const row = result.rows?.[0] || {};
    const p_status = Number(row.p_status);
    const p_message = row.p_message;

    // Clean up Redis
    await Redis.del(`otp:${email}`);
    await Redis.del(`pendingUser:${email}`);

    if (p_status === 1) {
      return res.status(200).json({ message: p_message, p_status });
    }

    if (p_status === 0) {
      return res.status(400).json({ message: p_message, p_status });
    }

    return res.status(500).json({ message: "something went wrong", p_status });

  } catch (error) {
    console.error("OTP Verification & Registration Error:", error);
    res.status(500).json({ message: "Error verifying OTP or registering user." });
  }
};

// Login
export const loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await client.query(
      "CALL ins.usp_login_user($1::VARCHAR, $2::JSON, $3::SMALLINT, $4::TEXT);",
      [email, null, null, null]
    );

    const row = result.rows[0] || {};
    const user = row.p_loginuser;
    const p_status = Number(row.p_status);
    const p_message = row.p_message || "Unknown response from DB";

    if (p_status === 1) {
      if (!user || user.code === "NOTREGISTERED") {
        return res.status(404).json({
          status: false,
          message: user?.message || "User not registered",
          code: user?.code || "NOTREGISTERED",
        });
      }

      const isMatch = await bcrypt.compare(password, user.passwordhash);

      if (!isMatch) {
        return res.status(401).json({
          status: false,
          message: "Incorrect password",
        });
      }

      const token = jwt.sign(
        {
          id: user.userid,
          email: email,
          role: user.roleid,
          name: user.fullname,
          p_code: user.code,
        },
        JWT_SECRET,
        { expiresIn: "1h" }
      );

      return res.status(200).json({
        status: true,
        message: "Welcome back " + user.fullname,
        token,
        id: user.userid,
        name: user.fullname,
        email,
        role: user.roleid,
        p_code: user.code,
        p_message: user.message,
      });
    }

    if (p_status === 0) {
      return res.status(400).json({ status: false, message: p_message });
    }

    return res.status(500).json({
      status: false,
      message: "Unexpected database error",
    });

  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Server error during login" });
  }
};

// Resend OTP
export const resendOtp = async (req, res) => {
  const email = req.body.email.toLowerCase();

  try {
    await Redis.del(`otp:${email}`);

    const otpCode = generateOTP();

    await sendingMail(
      email,
      "InflueSage OTP Verification - Resend",
      htmlContent({ otp: otpCode })
    );

    await Redis.setEx(`otp:${email}`, 300, otpCode);

    const userData = await Redis.get(`pendingUser:${email}`);

    if (userData) {
      await Redis.setEx(`pendingUser:${email}`, 300, userData);
    }

    return res.status(200).json({ message: "OTP resent successfully." });
  } catch (error) {
    console.error("Resend OTP Error:", error);
    return res.status(500).json({ message: "Error resending OTP." });
  }
};

// Forgot password
export const forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
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

    await Redis.setEx(`reset:${resetToken}`, 600, userId);

    await sendingMail(
      email,
      "InflueSage Password Reset",
      `Click to reset your password: ${resetUrl}`
    );

    return res.status(200).json({ message: "Reset link sent to email." });
  } catch (error) {
    console.error("Forget Password Error:", error);
    return res.status(500).json({ message: "Error initiating password reset." });
  }
};

// Reset password
export const resetPassword = async (req, res) => {
  const { token, password } = req.body;

  try {
    const userId = await Redis.get(`reset:${token}`);

    if (!userId) {
      return res.status(400).json({ message: "Invalid or expired reset token." });
    }

    const passwordhash = await bcrypt.hash(password, 10);

    const updateResult = await client.query(
      `CALL ins.usp_reset_userpassword($1::BIGINT, $2::VARCHAR, NULL, NULL)`,
      [userId, passwordhash]
    );

    const row = updateResult.rows?.[0] || {};
    const p_status = Number(row.p_status);
    const p_message = row.p_message;

    await Redis.del(`reset:${token}`);

    if (p_status === 1) {
      return res.status(200).json({
        status: p_status,
        message: p_message || "Password reset successfully",
      });
    }

    if (p_status === 0) {
      return res.status(400).json({
        status: false,
        message: p_message || "Validation failed",
      });
    }

    return res.status(500).json({
      status: false,
      message: "Something went wrong. Please try again later.",
    });

  } catch (error) {
    console.error("Reset Password Error:", error);
    return res.status(500).json({ message: "Error resetting password." });
  }
};
