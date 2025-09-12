import { client } from "../config/db.js";
import { google } from "googleapis";
import { generateToken } from "../utils/jwt.js";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
dotenv.config();


async function getUserByEmail(email) {
  const result = await client.query(
    "SELECT * FROM ins.fn_get_loginpassword($1)",
    [email]
  );
  return result.rows[0];
}

async function createUser(data) {
  const { firstname, lastname, email, passwordhash, roleId } = data;

  const result = await client.query(
    `CALL ins.usp_insert_user(
      $1::VARCHAR,  
      $2::VARCHAR,  
      $3::VARCHAR,  
      $4::VARCHAR,  
      $5::BOOLEAN,  
      $6::SMALLINT, 
      NULL,         
      NULL,         
      NULL          
    )`,
    [firstname, lastname, email, passwordhash, true, roleId]
  );

  const { p_code, p_message } = result.rows[0] || {};
  return { p_code, p_message };
}

// Google OAuth Redirect

export async function getGoogleLoginPage(req, res) {
  try {
    const { roleid } = req.query;

    const redirectUrl =
      `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${process.env.GOOGLE_CLIENT_ID}` +
      `&redirect_uri=http://localhost:3001/auth/google/callback` +
      `&response_type=code` +
      `&scope=openid email profile`;

    // role cookie store 
    res.cookie("selected_role", roleid || 1, {
      maxAge: 10 * 60 * 1000,
      httpOnly: true,
      secure: false,
      sameSite: "lax",
    });

    res.redirect(redirectUrl);
  } catch (err) {
    console.error("[ERROR] getGoogleLoginPage:", err);
    res.status(500).json({ message: "Server error generating Google login" });
  }
}

// Google OAuth Callback
export async function getGoogleLoginCallback(req, res) {
  const { code } = req.query;
  const selectedRole = req.cookies["selected_role"];

  if (!code) {
    console.error("[ERROR] Invalid Google login attempt");
    return res.status(401).json({ message: "Invalid Google login attempt" });
  }

  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      "http://localhost:3001/auth/google/callback"
    );

    // token exchange
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const { data } = await oauth2.userinfo.get();

    // DB check
    let user = await getUserByEmail(data.email);
    // console.log(user)

    if (!user) {
      const redirectUrl = `http://localhost:5173/roledefault?email=${encodeURIComponent(
        data.email
      )}&firstName=${encodeURIComponent(data.given_name || "")}&lastName=${encodeURIComponent(
        data.family_name || ""
      )}&roleId=${selectedRole || ""}`;

      return res.redirect(redirectUrl);
    }

    //  user already exist -> JWT token generate
    const token = generateToken({
      id: user.userid,
      role: user.roleid,
      firstName: user.firstname,
      lastName: user.lastname,
      email: user.email,
    });

    const redirectUrl = `http://localhost:5173/login?token=${token}&userId=${user.userid
      }&roleId=${user.roleid}&firstName=${encodeURIComponent(
        user.firstname
      )}&lastName=${encodeURIComponent(user.lastname)}&email=${encodeURIComponent(
        user.email
      )}`;

    res.redirect(redirectUrl);
  } catch (err) {
    console.error("[ERROR] Google login callback failed:", err);
    return res.status(500).json({ message: "Server error during Google login" });
  }
}

// Set Password After Google Signup
export async function setPasswordAfterGoogleSignup(req, res) {
  try {
    const { email, firstName, lastName, roleId, password } = req.body;

    if (!email || !password || !roleId) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ message: "User already exists, please login" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await createUser({
      firstname: firstName || "",
      lastname: lastName || "",
      email,
      passwordhash: hashedPassword,
      roleId,
    });

    const user = await getUserByEmail(email);
    // generate token for newly created user
    const token = generateToken({
      id: user.userid,
      role: user.roleid,
      firstName: user.firstname,
      lastName: user.lastname,
      email: user.email,
    });

    return res.status(201).json({
      success: true,
      message: "Signup completed successfully",
      token,
      user: {
        id: user.userid,
        role: user.roleid,
        firstName: user.firstname,
        lastName: user.lastname,
        email: user.email,
      },
    });
  } catch (err) {
    console.error("[ERROR] setPasswordAfterGoogleSignup failed:", err);
    return res.status(500).json({ message: "Server error while creating user" });
  }
}

// Facebook OAuth Redirect
export async function getFacebookLoginPage(req, res) {
  try {
    const { roleid } = req.query;

    const redirectUrl =
      `https://www.facebook.com/v17.0/dialog/oauth?` +
      `client_id=${process.env.FACEBOOK_APP_ID}` +
      `&redirect_uri=http://localhost:3001/auth/facebook/callback` +
      `&scope=email,public_profile`;

    // role cookie store
    res.cookie("selected_role", roleid, {
      maxAge: 10 * 60 * 1000,
      httpOnly: true,
      secure: false,
      sameSite: "lax",
    });

    res.redirect(redirectUrl);
  } catch (err) {
    console.error("[ERROR] getFacebookLoginPage:", err);
    res.status(500).json({ message: "Server error generating Facebook login" });
  }
}

// Facebook OAuth Callback
export async function getFacebookLoginCallback(req, res) {
  const { code } = req.query;
  const selectedRole = req.cookies["selected_role"];

  if (!code) {
    console.error("[ERROR] Invalid Facebook login attempt");
    return res.status(401).json({ message: "Invalid Facebook login attempt" });
  }

  try {
    // Exchange code for access token
    const tokenRes = await axios.get(
      `https://graph.facebook.com/v17.0/oauth/access_token?` +
      `client_id=${process.env.FACEBOOK_APP_ID}` +
      `&redirect_uri=http://localhost:3001/auth/facebook/callback` +
      `&client_secret=${process.env.FACEBOOK_APP_SECRET}` +
      `&code=${code}`
    );

    const accessToken = tokenRes.data.access_token;

    // Fetch user info from Facebook
    const userRes = await axios.get(
      `https://graph.facebook.com/me?fields=id,first_name,last_name,email&access_token=${accessToken}`
    );

    const fbUser = userRes.data;
    console.log(" Facebook user data:", fbUser);

    if (!fbUser.email) {
      console.error("[ERROR] Facebook login returned no email");
      return res.status(400).json({ message: "Facebook login failed: no email found" });
    }

    // Check if user exists
    let user = await getUserByEmail(fbUser.email);

    if (!user) {
      // New user → redirect to role
      const redirectUrl = `http://localhost:5173/roledefault?email=${encodeURIComponent(
        fbUser.email
      )}&firstName=${encodeURIComponent(fbUser.first_name || "")}&lastName=${encodeURIComponent(
        fbUser.last_name || ""
      )}&roleId=${selectedRole || ""}`;

      return res.redirect(redirectUrl);
    }

    // Existing user -> generate token
    const token = generateToken({
      id: user.userid,
      role: user.roleid,
      firstName: user.firstname,
      lastName: user.lastname,
      email: user.email,
    });

    // Redirect to frontend with token
    const redirectUrl = `http://localhost:5173/login?token=${token}&userId=${user.userid}&roleId=${user.roleid
      }&firstName=${encodeURIComponent(user.firstname)}&lastName=${encodeURIComponent(
        user.lastname
      )}&email=${encodeURIComponent(user.email)}`;

    res.redirect(redirectUrl);
  } catch (err) {
    console.error("[ERROR] Facebook login callback failed:", err);
    return res.status(500).json({ message: "Server error during Facebook login" });
  }
}
