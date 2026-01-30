import { client } from "../../config/Db.js";
import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import Redis from "../../utils/RedisWrapper.js";
import { sendingMail } from "../../utils/MailUtils.js";
import { htmlContent } from "../../utils/EmailTemplates.js";
import { SP_STATUS, HTTP } from "../../utils/Constants.js";
import { generateAccessToken, generateRefreshToken } from "../../utils/Jwt.js";

const JWT_SECRET = process.env.JWT_SECRET;

/* ====================== COMMON UTILS ====================== */

const normalizeEmail = (email) => email.toLowerCase().trim();

const generateOTP = () =>
  Math.floor(1000 + Math.random() * 9000).toString();

const isEmailExists = async (email) => {
  const { rows } = await client.query(
    `CALL ins.usp_is_registered($1::VARCHAR,NULL,NULL)`,
    [email]
  );
  return rows[0]?.p_isregistered;
};

const runTransaction = async (userId, callback) => {
  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT set_config('app.current_user_id', $1, true)",
      [userId ? String(userId) : null]
    );
    const result = await callback();
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
};

const respondByStatus = (res, row, successData = {}) => {
  const p_status = Number(row?.p_status);
  const p_message = row?.p_message;

  if (p_status === SP_STATUS.SUCCESS)
    return res.status(HTTP.OK).json({ status: true, message: p_message, ...successData });

  if (p_status === SP_STATUS.VALIDATION_FAIL)
    return res.status(HTTP.BAD_REQUEST).json({ status: false, message: p_message });

  console.error("Stored Procedure Error:", p_message);
  return res.status(HTTP.INTERNAL_ERROR).json({ status: false, message: "Something went wrong" });
};

/* ====================== REGISTER ====================== */

export const requestRegistration = async (req, res) => {
  try {
    const { firstName, lastName, email, roleId, password } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (await isEmailExists(normalizedEmail)) {
      return res.status(HTTP.BAD_REQUEST).json({ message: "User already exists" });
    }

    const passwordhash = await bcrypt.hash(password, 10);
    const otp = generateOTP();

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

    return res.status(HTTP.OK).json({ message: "OTP sent successfully" });
  } catch (err) {
    console.error("Request Registration Error:", err);
    return res.status(HTTP.INTERNAL_ERROR).json({ message: "Registration failed" });
  }
};

/* ====================== VERIFY OTP ====================== */

export const verifyOtpAndRegister = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const { otp } = req.body;

    const storedOtp = await Redis.get(`otp:${email}`);
    if (!storedOtp || String(storedOtp) !== String(otp)) {
      return res.status(HTTP.BAD_REQUEST).json({ message: "Invalid or expired OTP" });
    }

    const pendingUser = await Redis.get(`pendingUser:${email}`);
    if (!pendingUser) {
      return res.status(HTTP.BAD_REQUEST).json({ message: "No pending registration found" });
    }

    const { firstName, lastName, roleId, passwordhash } = pendingUser;

    const result = await runTransaction(null, () =>
      client.query(
        `CALL ins.usp_insert_user($1,$2,$3,$4,$5,$6,NULL,NULL)`,
        [firstName, lastName, email, passwordhash, true, roleId]
      )
    );

    const row = result.rows[0];

    if (row.p_status === SP_STATUS.SUCCESS) {
      await Redis.del(`otp:${email}`);
      await Redis.del(`pendingUser:${email}`);
    }

    return respondByStatus(res, row);
  } catch (err) {
    console.error("OTP Verification Error:", err);
    return res.status(HTTP.INTERNAL_ERROR).json({ message: "OTP verification failed" });
  }
};

/* ====================== LOGIN ====================== */

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

    if (p_status === SP_STATUS.SUCCESS) {
      if (!user || user.code === "NOTREGISTERED") {
        return res.status(HTTP.NOT_FOUND).json({
          status: false,
          message: user?.message || "User not registered",
          code: user?.code || "NOTREGISTERED",
        });
      }

      const isMatch = await bcrypt.compare(password, user.passwordhash);
      if (!isMatch) {
        return res.status(HTTP.UNAUTHORIZED).json({
          status: false,
          message: "Incorrect password",
        });
      }

      // Generate tokens
      const accessToken = generateAccessToken(user);
      const refreshToken = generateRefreshToken(user);
//       console.log("Cookies object:", req.cookies);
// console.log("Raw cookie header:", req.headers.cookie);


      // Set refresh token in HTTP-only cookie
      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        maxAge: 3 * 60 * 60 * 1000, // 3 hours
      });

      return res.status(HTTP.OK).json({
        status: true,
        message: "Welcome back " + user.fullname,
        token: accessToken, // frontend uses this
        id: user.userid,
        name: user.fullname,
        email,
        role: user.roleid,
        p_code: user.code,
        p_message: user.message,
        source: "db",
      });
    } else if (p_status === SP_STATUS.VALIDATION_FAIL) {
      return res.status(HTTP.BAD_REQUEST).json({
        status: false,
        message: p_message,
        source: "db",
      });
    } else {
      return res.status(HTTP.INTERNAL_ERROR).json({
        status: false,
        message: "Unexpected database error",
        source: "db",
      });
    }
  } catch (error) {
    console.error("Login error:", error);
    return res.status(HTTP.INTERNAL_ERROR).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};

/* ====================== RESEND OTP ====================== */

export const resendOtp = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const otp = generateOTP();

    // Store OTP with TTL
    await Redis.setEx(`otp:${email}`, 300, otp);

    // Get pending user
    const pendingUser = await Redis.get(`pendingUser:${email}`);

    // Reset TTL ONLY if exists
    if (pendingUser) {
      await Redis.setEx(`pendingUser:${email}`, 300, pendingUser);
    }

    await sendingMail(
      email,
      "InflueSage OTP Verification - Resend",
      htmlContent({ otp })
    );

    return res.status(HTTP.OK).json({ message: "OTP resent successfully" });
  } catch (err) {
    console.error("Resend OTP Error:", err);
    return res.status(HTTP.INTERNAL_ERROR).json({ message: "Failed to resend OTP" });
  }
};

/* ====================== FORGOT PASSWORD ====================== */

export const forgotPassword = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);

    if (!(await isEmailExists(email))) {
      return res.status(HTTP.NOT_FOUND).json({ message: "User not found" });
    }

    const { rows } = await client.query(
      `SELECT * FROM ins.fn_get_loginpassword($1::VARCHAR)`,
      [email]
    );

    const token = crypto.randomBytes(32).toString("hex");
    await Redis.setEx(`reset:${token}`, 600, rows[0].userid);

    await sendingMail(
      email,
      "InflueSage Password Reset",
      `${process.env.FRONTEND_URL}/reset-password?token=${token}`
    );

    return res.status(HTTP.OK).json({ message: "Reset link sent successfully" });
  } catch (err) {
    console.error("Forgot Password Error:", err);
    return res.status(HTTP.INTERNAL_ERROR).json({ message: "Failed to send reset link" });
  }
};

/* ====================== RESET PASSWORD ====================== */

export const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    const userId = await Redis.get(`reset:${token}`);

    if (!userId) {
      return res.status(HTTP.BAD_REQUEST).json({ message: "Invalid or expired token" });
    }

    const passwordhash = await bcrypt.hash(password, 10);

    const result = await runTransaction(userId, () =>
      client.query(
        `CALL ins.usp_reset_userpassword($1,$2,NULL,NULL)`,
        [userId, passwordhash]
      )
    );

    const row = result.rows[0];

    if (row.p_status === SP_STATUS.SUCCESS) {
      await Redis.del(`reset:${token}`);
    }

    return respondByStatus(res, row);
  } catch (err) {
    console.error("Reset Password Error:", err);
    return res.status(HTTP.INTERNAL_ERROR).json({ message: "Password reset failed" });
  }
};
