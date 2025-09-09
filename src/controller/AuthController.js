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

// Google login redirect
export async function getGoogleLoginPage(req, res) {
  const state = randomBytes(16).toString("hex");
  const { roleid } = req.query; // frontend choice

  const redirectUrl =
    `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${process.env.GOOGLE_CLIENT_ID}` +
    `&redirect_uri=http://localhost:3001/auth/google/callback` +
    `&response_type=code` +
    `&scope=openid email profile` +
    `&state=${state}`;

  // state + roleId dono cookie me daal do
  res.cookie("google_oauth_state", state, {
    maxAge: OAUTH_EXCHANGE_EXPIRY,
    httpOnly: true,
    secure: false,
  });

  res.cookie("selected_role", roleid, {
    maxAge: OAUTH_EXCHANGE_EXPIRY,
    httpOnly: true,
    secure: false,
  });

  res.redirect(redirectUrl);
}

// Google callback
// Google callback
export async function getGoogleLoginCallback(req, res) {
  const { code, state } = req.query;
  const storedState = req.cookies["google_oauth_state"];
  const selectedRole = req.cookies["selected_role"]; // frontend choice

  if (!code || !state || state !== storedState) {
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

    let user = await getUserByEmail(data.email);

    if (!user) {
      const randomPassword = randomBytes(16).toString("hex");
      const hashedPassword = await bcrypt.hash(randomPassword, 10);

      const dbResponse = await createUser({
        firstname: data.given_name || "",
        lastname: data.family_name || "",
        email: data.email,
        passwordhash: hashedPassword,
        roleId: selectedRole || 1, // fallback
      });

      console.log("✅ User created with SP:", dbResponse);

      user = await getUserByEmail(data.email);

      if (!user || !user.userid) {
        console.error("❌ User create hua, par DB se fetch nahi hua");
        return res.status(500).json({ message: "User creation failed" });
      }
    }

    // 🔑 Token generate (same as loginUser)
    const token = generateToken({
      id: user.userid,
      email: user.email,
      role: user.roleid,
      name: `${user.firstname}_${user.lastname}`,
    });

    // backend: getGoogleLoginCallback
    // return res.status(200).json({
    //   message: "Google login successful",
    //   token,
    //   id: user.userid,
    //   firstName: user.firstname,
    //   lastName: user.lastname,
    //   role: user.roleid,
    // });

    // const redirectUrl = `http://localhost:5173/login?token=${token}&id=${user.userid}&role=${user.roleid}&firstName=${user.firstname}&lastName=${user.lastname}`;
    // res.redirect(redirectUrl);
    if (user.roleid == 1) {  
      const redirectUrl = `http://localhost:5173/complate-profile`;
      return res.redirect(redirectUrl);
    } else if (user.roleid == 2) {
      const redirectUrl = `http://localhost:5173/complete-vendor-profile`;
      return res.redirect(redirectUrl);
    } else {
      const redirectUrl = `http://localhost:5173/login`;
      return res.redirect(redirectUrl);
    }

  } catch (err) {
    console.error("Google login error:", err);
    return res
      .status(500)
      .json({ message: "Server error during Google login" });
  }
}

// export const authGoogle = (req, res, next) => {
//   // Initiates Google OAuth
//   const passport = req.app.get("passport");
//   passport.authenticate("google", { scope: ["profile", "email"] })(req, res, next);
// };

// export const authGoogleCallback = (req, res, next) => {
//   const passport = req.app.get("passport");
//   passport.authenticate("google", (err, user, info) => {
//     if (err) return res.status(500).json({ error: err.message });
//     if (!user) return res.status(401).json({ error: "Google login failed" });

//     req.login(user, (err) => {
//       if (err) return res.status(500).json({ error: err.message });
//       // Return JSON with user info and maybe a JWT or session info
//       res.json({ message: "Google login successful", user });
//     });
//   })(req, res, next);
// };
// src/controllers/AuthController.js

// Changes For Apple Id Login

// export const loginSuccess = (req, res) => {
//   if (req.user) {
//     res.status(200).json({
//       message: 'Login successful',
//       user: req.user
//     });
//   } else {
//     res.status(401).json({ message: 'Unauthorized' });
//   }
// };

// export const loginFailure = (req, res) => {
//   res.status(401).json({ message: 'Login failed' });
// };

// export const logout = (req, res) => {
//   req.logout(() => {
//     res.redirect('/');
//   });
// };
