import { OAUTH_EXCHANGE_EXPIRY } from "../config/constants.js";
import { client } from "../config/db.js";
import authenticateUser from "../middleware/AuthMiddleware.js";
import { google } from "googleapis"; // for token exchange
import { randomBytes } from "crypto";
import cookieParser from "cookie-parser";
import { generateToken } from "../utils/jwt.js";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
dotenv.config();

// const { BACKEND_PORT, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = process.env;

// Example: call stored procedure
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

  // Assuming SP returns OUT params as rows
  const { p_code, p_message } = result.rows[0];
  console.log("DB Response:", { p_code, p_message });

  return { p_code, p_message };
}

// Google OAuth redirect
export async function getGoogleLoginPage(req, res) {
  try {
    const state = randomBytes(16).toString("hex");
    const { roleid } = req.query;

    // console.log("[DEBUG] Generating Google OAuth state:", state, "roleid:", roleid);

    const redirectUrl =
      `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${process.env.GOOGLE_CLIENT_ID}` +
      `&redirect_uri=http://localhost:3001/auth/google/callback` +
      `&response_type=code` +
      `&scope=openid email profile` +
      `&state=${state}`;

    res.cookie("google_oauth_state", state, {
      maxAge: 10 * 60 * 1000, // 10 min
      httpOnly: true,
      secure: false,
      sameSite: "lax",
    });

    res.cookie("selected_role", roleid, {
      maxAge: 10 * 60 * 1000,
      httpOnly: true,
      secure: false,
      sameSite: "lax",
    });

    // console.log("[DEBUG] Redirecting to Google OAuth:", redirectUrl);
    res.redirect(redirectUrl);
  } catch (err) {
    // console.error("[ERROR] getGoogleLoginPage:", err);
    res.status(500).json({ message: "Server error generating Google login" });
  }
}

// Google OAuth callback
export async function getGoogleLoginCallback(req, res) {
  const { code, state } = req.query;
  const storedState = req.cookies["google_oauth_state"];
  const selectedRole = req.cookies["selected_role"] || 1;

  // console.log("[DEBUG] Callback query code:", code, "state:", state);
  // console.log("[DEBUG] Stored state cookie:", storedState);
  // console.log("[DEBUG] Selected role cookie:", selectedRole);

  if (!code || !state || state !== storedState) {
    console.error("[ERROR] Invalid Google login attempt");
    return res.status(401).json({ message: "Invalid Google login attempt" });
  }

  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      "http://localhost:3001/auth/google/callback"
    );

    // console.log("[DEBUG] Exchanging code for tokens...");
    const { tokens } = await oauth2Client.getToken(code);
    // console.log("[DEBUG] Received tokens:", tokens);

    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const { data } = await oauth2.userinfo.get();
    // console.log("[DEBUG] Google user info:", data);

    let user = await getUserByEmail(data.email);
    // console.log("[DEBUG] Existing user from DB:", user);

    if (!user) {
      // console.log("[DEBUG] Creating new user...");
      const randomPassword = randomBytes(16).toString("hex");
      const hashedPassword = await bcrypt.hash(randomPassword, 10);

      await createUser({
        firstname: data.given_name || "",
        lastname: data.family_name || "",
        email: data.email,
        passwordhash: hashedPassword,
        roleId: selectedRole,
      });

      user = await getUserByEmail(data.email);
      // console.log("[DEBUG] Newly created user:", user);
    }

    // Generate token
    const token = generateToken({
      id: user.userid,     
      role: user.roleid,    
      firstName: user.firstname,
      lastName: user.lastname,
    });

    // console.log("[DEBUG] Generated JWT token:", token);

    const redirectUrl = `http://localhost:5173/login?token=${token}&userId=${user.userid}&roleId=${user.roleid}&firstName=${user.firstname}&lastName=${user.lastname}`;
    // console.log("[DEBUG] Redirecting to frontend:", redirectUrl);

    res.redirect(redirectUrl);
  } catch (err) {
    console.error("[ERROR] Google login callback failed:", err);
    return res.status(500).json({ message: "Server error during Google login" });
  }
}

// export async function getFacebookLoginPage(req, res) {
//   try {
//     const state = randomBytes(16).toString("hex");
//     const { roleid } = req.query;
//     const redirectUrl =
//       `https://www.facebook.com/v10.0/dialog/oauth?` +
//       `client_id=${process.env.FACEBOOK_APP_ID}` +
//       `&redirect_uri=http://localhost:3001/auth/facebook/callback` +
//       `&state=${state}` +
//       `&scope=email,public_profile`;
//     res.cookie("facebook_oauth_state", state, {
//       maxAge: 10 * 60 * 1000, // 10 min
//       httpOnly: true,
//       secure: false,
//       sameSite: "lax",
//     });
//     res.cookie("selected_role", roleid, {
//       maxAge: 10 * 60 * 1000,
//       httpOnly: true,
//       secure: false,
//       sameSite: "lax",
//     });
//     res.redirect(redirectUrl);
//   } catch (err) {
//     res.status(500).json({ message: "Server error generating Facebook login" });
//   }
// }

// export async function getFacebookLoginCallback(req, res) {
//   const { code, state } = req.query;
//   const storedState = req.cookies["facebook_oauth_state"];
//   const selectedRole = req.cookies["selected_role"] || 1;

//   if (!code || !state || state !== storedState) {
//     console.error("[ERROR] Invalid Facebook login attempt");
//     return res.status(401).json({ message: "Invalid Facebook login attempt" });
//   }

//   try {
//     // Exchange code for access token
//     const tokenRes = await axios.get(
//       `https://graph.facebook.com/v17.0/oauth/access_token?` +
//         `client_id=${process.env.FACEBOOK_CLIENT_ID}` +
//         `&redirect_uri=http://localhost:3001/auth/facebook/callback` +
//         `&client_secret=${process.env.FACEBOOK_CLIENT_SECRET}` +
//         `&code=${code}`
//     );

//     const accessToken = tokenRes.data.access_token;

//     // Fetch user info from Facebook
//     const userRes = await axios.get(
//       `https://graph.facebook.com/me?fields=id,first_name,last_name,email&access_token=${accessToken}`
//     );

//     const fbUser = userRes.data;
//     console.log("✅ Facebook user data:", fbUser);

//     let user = await getUserByEmail(fbUser.email);

//     if (!user) {
//       const randomPassword = randomBytes(16).toString("hex");
//       const hashedPassword = await bcrypt.hash(randomPassword, 10);

//       await createUser({
//         firstname: fbUser.first_name || "",
//         lastname: fbUser.last_name || "",
//         email: fbUser.email,
//         passwordhash: hashedPassword,
//         roleId: selectedRole,
//       });

//       user = await getUserByEmail(fbUser.email);
//     }

//     // Generate JWT token
//     const token = generateToken({
//       id: user.userid,
//       role: user.roleid,
//       firstName: user.firstname,
//       lastName: user.lastname,
//     });

//     const redirectUrl = `http://localhost:5173/login?token=${token}&userId=${user.userid}&roleId=${user.roleid}&firstName=${user.firstname}&lastName=${user.lastname}`;
//     console.log(" Redirecting to frontend:", redirectUrl);

//     res.redirect(redirectUrl);
//   } catch (err) {
//     console.error("[ERROR] Facebook login callback failed:", err);
//     return res.status(500).json({ message: "Server error during Facebook login" });
//   }
// }