import { client } from "../config/Db.js";
import { google } from "googleapis";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import axios from "axios";
import jwt from "jsonwebtoken";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;

/* =====================================================
   COMMON HELPER : GET USER USING USP
===================================================== */
async function getUserByEmail(email) {
  const result = await client.query(
    "CALL ins.usp_login_user($1::VARCHAR, $2::JSON, $3::SMALLINT, $4::TEXT);",
    [email, null, null, null]
  );

  const row = result.rows[0] || {};

  return {
    p_status: Number(row.p_status),
    p_message: row.p_message || "Unknown DB response",
    user: row.p_loginuser || null,
  };
}

/* =====================================================
   CREATE USER (FOR SOCIAL SIGNUP)
===================================================== */
async function createUser({ firstName, lastName, email, passwordhash, roleId }) {
  try {
  const result = await client.query(
        `CALL ins.usp_insert_user($1::VARCHAR, $2::VARCHAR, $3::VARCHAR, $4::VARCHAR, $5::BOOLEAN, $6::SMALLINT, $7::SMALLINT, $8::TEXT);`,
        [firstName, lastName, email, passwordhash, true, roleId, null, null]
      );
  
      const row = result.rows?.[0] || {};
      const p_status = Number(row.p_status);
      const p_message = row.p_message;
    
      if (p_status === 1) {
        return { message: p_message, p_status };
      }
  
      if (p_status === 0) {
        return { message: p_message, p_status };
      }
  
      if (p_status === -1) {
        console.error("Stored Procedure Failure:", p_message);
        return { message: "Something went wrong. Please try again later.", p_status: -1 };
      }
  } catch (error) {
    console.error("Error in createUser:", error);
    return res.status(500).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
}
    
/* =====================================================
   GOOGLE OAUTH REDIRECT
===================================================== */
export async function getGoogleLoginPage(req, res) {
  try {
    const { roleid } = req.query;

    const redirectUrl =
      `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${process.env.GOOGLE_CLIENT_ID}` +
      `&redirect_uri=http://localhost:3001/auth/google/callback` +
      `&response_type=code` +
      `&scope=openid email profile`;

    res.cookie("selected_role", roleid || 1, {
      maxAge: 10 * 60 * 1000,
      httpOnly: true,
      secure: false,
      sameSite: "lax",
    });

    res.redirect(redirectUrl);
  } catch (err) {
    console.error("[ERROR] getGoogleLoginPage:", err);
    return res.status(500).json({
      message: "Something went wrong. Please try again later.",
      error: err.message,
    });
  }
}

/* =====================================================
   GOOGLE OAUTH CALLBACK
===================================================== */
export async function getGoogleLoginCallback(req, res) {
  const { code } = req.query;
  const selectedRole = req.cookies["selected_role"];

  if (!code) {
    return res.status(401).json({ message: "Invalid Google login attempt" });
  }

  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      "http://localhost:3001/auth/google/callback"
    );

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const { data } = await oauth2.userinfo.get();

    const { p_status, p_message, user } = await getUserByEmail(data.email);

    if (p_status === 1) {
      if (!user || user.code === "NOTREGISTERED") {
        const redirectUrl = `http://localhost:5173/roledefault?email=${encodeURIComponent(
          data.email
        )}&firstName=${encodeURIComponent(
          data.given_name || ""
        )}&lastName=${encodeURIComponent(
          data.family_name || ""
        )}&roleId=${selectedRole || ""}`;

        return res.redirect(redirectUrl);
      }

      const token = jwt.sign(
        {
          id: user.userid,
          role: user.roleid,
          email: data.email,
          name: user.name,
          p_code: user.code,
        },
        JWT_SECRET,
        { expiresIn: "1h" }
      );

      const redirectUrl = `http://localhost:5173/login?token=${token}&userId=${user.userid}&roleId=${user.roleid}&email=${encodeURIComponent(
        data.email
      )}`;

      return res.redirect(redirectUrl);
    }

    if (p_status === 0) {
      return res.status(400).json({ status: false, message: p_message });
    }

    if (p_status === -1) {
      console.error("USP Error:", p_message);
      return res.status(500).json({ message: "Database error during login" });
    }
  } catch (err) {
    console.error("[ERROR] Google callback:", err);
    return res.status(500).json({
      message: "Something went wrong. Please try again later.",
      error: err.message,
    });
  }
}

/* =====================================================
   SET PASSWORD AFTER GOOGLE SIGNUP
===================================================== */
export async function setPasswordAfterGoogleSignup(req, res) {
  try {
    const { email, firstName, lastName, roleId, password } = req.body;

    if (!email || !password || !roleId) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Check if user already exists
    const { p_status, user } = await getUserByEmail(email);

    if (p_status === 1 && user && user.code !== "NOTREGISTERED") {
      return res
        .status(400)
        .json({ message: "User already exists, please login" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user via procedure
    await createUser({
      firstName: firstName || "",
      lastName: lastName || "",
      email,
      passwordhash: hashedPassword,
      roleId,
    });

    // Fetch newly created user
    const loginRes = await getUserByEmail(email);


    const normalizedUser = {
      id: loginRes.user.userid,
      role: loginRes.user.roleid,
      name: loginRes.user.name || `${firstName} ${lastName}`,
      email: loginRes.user.email,
      p_code: loginRes.user.code,
    };

    // Generate JWT
    const token = jwt.sign(
      {
        id: normalizedUser.id,
        role: normalizedUser.role,
        name: normalizedUser.name,
        email: normalizedUser.email,
        p_code: normalizedUser.code,
      },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    // console.log("User after set password:", user);

    return res.status(201).json({
      success: true,
      message: "Signup completed successfully",
      token,
      user: normalizedUser,
    });
  } catch (err) {
    console.error("[ERROR] setPasswordAfterGoogleSignup:", err);
    return res.status(500).json({
      message: "Something went wrong. Please try again later.",
      error: err.message,
    });
  }
}

/* =====================================================
   FACEBOOK OAUTH REDIRECT
===================================================== */
export async function getFacebookLoginPage(req, res) {
  try {
    const { roleid } = req.query;

    const redirectUrl =
      `https://www.facebook.com/v17.0/dialog/oauth?` +
      `client_id=${process.env.FACEBOOK_APP_ID}` +
      `&redirect_uri=http://localhost:3001/auth/facebook/callback` +
      `&scope=email,public_profile`;

    res.cookie("selected_role", roleid, {
      maxAge: 10 * 60 * 1000,
      httpOnly: true,
      sameSite: "lax",
    });

    res.redirect(redirectUrl);
  } catch (err) {
    console.error("[ERROR] getFacebookLoginPage:", err);
    return res.status(500).json({
      message: "Something went wrong. Please try again later.",
      error: err.message,
    });
  }
}

/* =====================================================
   FACEBOOK OAUTH CALLBACK
===================================================== */
export async function getFacebookLoginCallback(req, res) {
  const { code } = req.query;
  const selectedRole = req.cookies["selected_role"];

  if (!code) {
    return res.redirect("http://localhost:5173/login");
  }

  try {
    const tokenRes = await axios.get(
      `https://graph.facebook.com/v17.0/oauth/access_token?client_id=${process.env.FACEBOOK_APP_ID}&redirect_uri=http://localhost:3001/auth/facebook/callback&client_secret=${process.env.FACEBOOK_APP_SECRET}&code=${code}`
    );

    const accessToken = tokenRes.data.access_token;

    const userRes = await axios.get(
      `https://graph.facebook.com/me?fields=first_name,last_name,email&access_token=${accessToken}`
    );

    const fbUser = userRes.data;

    const { p_status, p_message, user } = await getUserByEmail(fbUser.email);

    if (p_status === 1) {
      if (!user || user.code === "NOTREGISTERED") {
        const redirectUrl = `http://localhost:5173/roledefault?email=${encodeURIComponent(
          fbUser.email
        )}&firstName=${encodeURIComponent(
          fbUser.first_name || ""
        )}&lastName=${encodeURIComponent(
          fbUser.last_name || ""
        )}&roleId=${selectedRole || ""}`;

        return res.redirect(redirectUrl);
      }

      const token = jwt.sign(
        {
          id: user.userid,
          role: user.roleid,
          email: fbUser.email,
          p_code: user.code,
        },
        JWT_SECRET,
        { expiresIn: "1h" }
      );

      const redirectUrl = `http://localhost:5173/login?token=${token}&userId=${user.userid}&roleId=${user.roleid}&email=${encodeURIComponent(
        fbUser.email
      )}`;

      return res.redirect(redirectUrl);
    }

    if (p_status === 0) {
      return res.status(400).json({ message: p_message });
    }

    if (p_status === -1) {
      console.error("USP Error:", p_message);
      return res.status(500).json({ message: "Database error" });
    }
  } catch (err) {
    console.error("[ERROR] Facebook callback:", err);
    return res.redirect("http://localhost:5173/login");
  }
}
