import { client } from "../../config/Db.js";
import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { sendingMail } from "../../utils/MailUtils.js";
import Redis from "../../utils/redisWrapper.js";
import { htmlContent } from "../../utils/EmailTemplates.js";

// const Redis = redis.createClient({ url: process.env.REDIS_URL });
// Redis.connect().catch(console.error);

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
    // const keys = await Redis.keys("*");
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

    await Redis.setEx(
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
  // const userId = req.user?.id || req.body.userId;

  // if (!userId) {
  //   return res.status(401).json({
  //     status: false,
  //     message: "Unauthorized: user not found",
  //   });
  // }

  const email = req.body.email.toLowerCase(); // normalize email
  const { otp } = req.body;

  try {
    const storedOtp = await Redis.get(`otp:${email}`);
    // console.log(" OTP stored in Redis:", storedOtp);

    if (!storedOtp) {
      return res.status(400).json({ message: "OTP expired or not found." });
    }
    if (Number(storedOtp) !== Number(otp)) {
    // console.log("OTP mismatch!");
    return res.status(400).json({ message: "Invalid OTP." });
    }
    // console.log(" OTP matched successfully!");

    // Check pending user
    const userDataStr = await Redis.get(`pendingUser:${email}`);
    // console.log(" pendingUser data from Redis:", userDataStr);

    if (!userDataStr) {
      return res
        .status(400)
        .json({ message: "No pending registration found." });
    }

    const { firstName, lastName, roleId, passwordhash } =
      JSON.parse(userDataStr);

    await client.query("BEGIN");
    await client.query("SELECT set_config('app.current_user_id', $1, true)", [
      String(null),
    ]);
    // Insert user into DB
    const result = await client.query(
      `CALL ins.usp_insert_user($1::VARCHAR, $2::VARCHAR, $3::VARCHAR, $4::VARCHAR, $5::BOOLEAN, $6::SMALLINT, NULL, NULL)`,
      [firstName, lastName, email, passwordhash, true, roleId]
    );
    await client.query("COMMIT");

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

    if (p_status === -1) {
      console.error("Stored Procedure Failure:", p_message);
      return res
        .status(500)
        .json({ message: "something went wrong", p_status });
    }

    // Fallback (just in case DB sends something else)
    return res.status(400).json({ message: p_message, p_status });
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
      "CALL ins.usp_login_user($1::VARCHAR, $2::JSON, $3::SMALLINT, $4::TEXT);",
      [email, null, null, null]
    );

    const row = result.rows[0] || {};
    const user = row.p_loginuser;
    const p_status = Number(row.p_status);
    const p_message = row.p_message || "Unknown response from DB";

    // Handle DB response status
    if (p_status === 1) {
      if (!user || user.code === "NOTREGISTERED") {
        return res.status(404).json({
          status: false,
          message: user?.message || "User not registered",
          code: user?.code || "NOTREGISTERED",
          source: "db",
        });
      }

      if (!user.passwordhash) {
        return res.status(500).json({
          status: false,
          message: "Password hash missing in DB response",
          source: "db",
        });
      }

      // Compare entered password with hashed password
      const isMatch = await bcrypt.compare(password, user.passwordhash);

      if (!isMatch) {
        return res.status(401).json({
          status: false,
          message: "Incorrect password",
          source: "db",
        });
      }
      
      // if (user.code === "BLOCKED") {
      //   return res.status(403).json({
      //     message: "Your account has been blocked. Please contact support.",
      //   });
      // }

      // Generate JWT token
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
        email: email,
        role: user.roleid,
        p_code: user.code,
        p_message: user.message,
        source: "db",
      });
    } else if (p_status === 0) {
      return res.status(400).json({
        status: false,
        message: p_message,
        source: "db",
      });
    } else if (p_status === -1) {
      console.error("Stored Procedure Failure:", p_message);
      return res.status(500).json({
        status: false,
        message: "Unexpected database error",
        source: "db",
      });
    } else {
      return res.status(500).json({
        status: false,
        message: "Unknown database response",
        source: "db",
      });
    }
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
    await Redis.del(`otp:${email}`);
    // Generate OTP once only
    const otpCode = generateOTP();

    // Send Email with OTP
    await sendingMail(
      email,
      "InflueSage OTP Verification - Resend",
      htmlContent({ otp: otpCode })
    );

    // Store OTP in Redis with 5 minsec expiry
    await Redis.setEx(`otp:${email}`, 300, otpCode);

    // Reset pendingUser TTL if user exists
    const userData = await Redis.get(`pendingUser:${email}`);
    if (userData) {
      await Redis.expire(`pendingUser:${email}`, 300);
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

    await Redis.setEx(`reset:${resetToken}`, 600, userId);

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
    const userId = await Redis.get(`reset:${token}`);
    if (!userId) {
      return res
        .status(400)
        .json({ message: "Invalid or expired reset token." });
    }

    // Hash new password
    const passwordhash = await bcrypt.hash(password, 10);

    await client.query("BEGIN");
    await client.query("SELECT set_config('app.current_user_id', $1, true)", [
      String(userId),
    ]);
    // Update password in DB (adjust query as per your DB)
    const updateResult = await client.query(
      `CALL ins.usp_reset_userpassword($1::BIGINT, $2::VARCHAR, NULL, NULL)`,
      [userId, passwordhash]
    );
    await client.query("COMMIT");

    const row = updateResult.rows?.[0] || {};
    const p_status = Number(row.p_status);
    const p_message = row.p_message;

    // ----------------- REMOVE TOKEN FROM REDIS -----------------
    await Redis.del(`reset:${token}`);

    // ----------------- HANDLE p_status -----------------
    if (p_status === 1) {
      return res.status(200).json({
        status: p_status,
        message: p_message || "Password reset successfully",
      });
    } else if (p_status === 0) {
      return res.status(400).json({
        status: false,
        message: p_message || "Validation failed",
      });
    } else if (p_status === -1) {
      console.error("Stored Procedure Failure:", p_message);
      return res.status(500).json({
        status: false,
        message: "Something went wrong. Please try again later.",
      });
    } else {
      return res.status(500).json({
        status: false,
        message: "Unexpected database response",
      });
    }
  } catch (error) {
    console.error("Reset Password Error:", error);
    return res.status(500).json({ message: "Error resetting password." });
  }
};
