import { client } from "../config/Db.js";
import { google } from "googleapis";
import { generateToken } from "../utils/Jwt.js";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import axios from "axios";
import jwt from "jsonwebtoken";
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;

// ================== Helper Functions ==================

async function getUserByEmail(email) {
  const result = await client.query(
    "CALL ins.usp_login_user($1::VARCHAR, $2::JSON, $3::BOOLEAN, $4::TEXT);",
    [email, null, null, null]
  );

  const dbResponse = result.rows?.[0];
  if (!dbResponse) return null;

  const { p_loginuser, p_status, p_message } = dbResponse;
  let user = p_loginuser;

  // ✅ Parse JSON if returned as string
  if (typeof user === "string") {
    try {
      user = JSON.parse(user);
    } catch {
      user = null;
    }
  }

  if (!user || user.code === "NOTREGISTERED" || !user.userid) {
    console.warn(`[INFO] No user found for ${email}: ${user?.message || p_message}`);
    return null;
  }

  // ✅ Add fullname fallback
  user.fullname = user.fullname || `${user.firstname || ""} ${user.lastname || ""}`.trim();

  return user;
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

//  Common login handler used by both manual + social login
async function handleUserLogin(user) {
  const fullname = user.fullname || `${user.firstname || ""} ${user.lastname || ""}`.trim();

  const token = jwt.sign(
    {
      id: user.userid,
      email: user.email,
      role: user.roleid,
      name: fullname,
    },
    JWT_SECRET,
    { expiresIn: "1h" }
  );

  return {
    success: true,
    message: `Welcome back ${fullname}`,
    token,
    id: user.userid,
    name: fullname,
    email: user.email,
    role: user.roleid,
  };
}
// ================== Normal Login ==================

export const loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await client.query(
      "CALL ins.usp_login_user($1::VARCHAR, $2::JSON, $3::BOOLEAN, $4::TEXT);",
      [email, null, null, null]
    );

    const dbResponse = result.rows[0];
    if (!dbResponse) {
      return res.status(500).json({ message: "Invalid DB response" });
    }

    const user = dbResponse.p_loginuser;
    const p_status = dbResponse.p_status;
    const p_message = dbResponse.p_message;

    if (!user || user.code === "NOTREGISTERED") {
      return res.status(404).json({
        message: user?.message || "User not found",
        code: user?.code || "NOTREGISTERED",
      });
    }

    if (!user.passwordhash) {
      return res
        .status(400)
        .json({ message: "Password not set. Please set your password." });
    }

    if (!p_status) {
      return res.status(400).json({ message: p_message });
    }

    const isMatch = await bcrypt.compare(password, user.passwordhash);
    if (!isMatch) {
      return res.status(401).json({ message: "Incorrect password" });
    }

    const loginResponse = await handleUserLogin(user);

    return res.status(200).json(loginResponse);
  } catch (error) {
    console.error("[ERROR] loginUser:", error);
    return res.status(500).json({ message: "Server error during login" });
  }
};

// ================== Google OAuth ==================

export async function getGoogleLoginPage(req, res) {
  try {
    const { roleid } = req.query;

    const redirectUrl =
      `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${process.env.GOOGLE_CLIENT_ID}` +
      `&redirect_uri=${process.env.BACKEND_URL}/auth/google/callback` +
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
    res.status(500).json({ message: "Server error generating Google login" });
  }
}

export async function getGoogleLoginCallback(req, res) {
  const { code } = req.query;
  const selectedRole = req.cookies["selected_role"];

  if (!code) {
    console.error("[ERROR] Invalid Google login attempt");
    return res.status(401).json({ message: "Invalid Google login attempt" });
  }

  try {
    // ✅ FIX: initialize oauth2Client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.BACKEND_URL}/auth/google/callback`
    );

    // 🔹 Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // 🔹 Get user info from Google
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const { data } = await oauth2.userinfo.get();
    // console.log("🔹 Google user info:", data);

    if (!data.email) {
      console.error("❌ No email in Google profile");
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=no_email`);
    }

    // 🔹 Call your new login SP instead of fn_get_loginpassword
    // console.log("🔹 Checking user login in DB:", data.email);
    const result = await client.query(
      "CALL ins.usp_login_user($1::VARCHAR, $2::JSON, $3::BOOLEAN, $4::TEXT);",
      [data.email, null, null, null]
    );

    // console.log("🔹 SP result:", result.rows);

    const dbResponse = result.rows[0];
    const user = dbResponse?.p_loginuser;
    const p_status = dbResponse?.p_status;
    const p_message = dbResponse?.p_message;

    // 🔸 If user not found — redirect to role selection page
    if (!user || user.code === "NOTREGISTERED") {
      const redirectUrl = `${process.env.FRONTEND_URL}/roledefault?email=${encodeURIComponent(
        data.email
      )}&firstName=${encodeURIComponent(data.given_name || "")}&lastName=${encodeURIComponent(
        data.family_name || ""
      )}&roleId=${selectedRole || ""}`;
      return res.redirect(redirectUrl);
    }

    if (!p_status) {
      console.error("❌ Login SP failed:", p_message);
      return res.redirect(
        `${process.env.FRONTEND_URL}/login?error=${encodeURIComponent(p_message)}`
      );
    }

    // 🔹 Generate JWT token
    // ✅ Ensure fullname
if (user) {
  user.fullname =
    user.fullname ||
    `${user.firstname || ""} ${user.lastname || ""}`.trim() ||
    `${data.given_name || ""} ${data.family_name || ""}`.trim() ||
    data.name ||
    "User";
}

// ✅ Generate JWT with proper fullname
const token = generateToken({
  id: user.userid,
  role: user.roleid,
  firstName: user.firstname || data.given_name || "",
  lastName: user.lastname || data.family_name || "",
  email: user.email,
  name: user.fullname,
});

// ✅ Include fullname in redirect
const redirectUrl = `${process.env.FRONTEND_URL}/login?token=${token}&userId=${user.userid}&roleId=${user.roleid}&firstName=${encodeURIComponent(
  user.firstname || data.given_name || ""
)}&lastName=${encodeURIComponent(
  user.lastname || data.family_name || ""
)}&email=${encodeURIComponent(user.email)}&name=${encodeURIComponent(
  user.fullname
)}&p_code=${encodeURIComponent(user.code)}&p_message=${encodeURIComponent(
  user.message
)}`;


    // console.log("✅ Redirecting to:", redirectUrl);
    return res.redirect(redirectUrl);
  } catch (error) {
    console.error("❌ Google Login Error:", error.message);
    return res.redirect(`${process.env.FRONTEND_URL}/login?error=google_login_failed`);
  }
}



// ================== Google Signup Set Password ==================

export async function setPasswordAfterGoogleSignup(req, res) {
  try {
    const { email, firstName, lastName, roleId, password } = req.body;

    if (!email || !password || !roleId) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const existingUser = await getUserByEmail(email);
    // console.log("existingUser:", existingUser);
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "User already exists, please login" });
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

// ================== Facebook OAuth ==================

export async function getFacebookLoginPage(req, res) {
  try {
    const { roleid } = req.query;

    const redirectUrl =
      `https://www.facebook.com/v23.0/dialog/oauth?` +
      `client_id=${process.env.FACEBOOK_APP_ID}` +
      `&redirect_uri=${process.env.BACKEND_URL}/auth/facebook/callback` +
      `&scope=email,public_profile`;

    res.cookie("selected_role", roleid, {
      maxAge: 10 * 60 * 1000,
      httpOnly: true,
      secure: true,
      sameSite: "none",
    });

    res.redirect(redirectUrl);
  } catch (err) {
    console.error("[ERROR] getFacebookLoginPage:", err);
    res.status(500).json({ message: "Server error generating Facebook login" });
  }
}

export async function getFacebookLoginCallback(req, res) {
  const { code, err } = req.query;
  const selectedRole = req.cookies["selected_role"];

  if (err || !code) {
    console.warn("[INFO] Facebook login canceled or invalid attempt");
    return res.redirect(`${process.env.FRONTEND_URL}/login?error=facebook_login_canceled`);
  }

  try {
    // 🔹 Exchange code for access token
    const tokenRes = await axios.get(
      `https://graph.facebook.com/v23.0/oauth/access_token?` +
        `client_id=${process.env.FACEBOOK_APP_ID}` +
        `&redirect_uri=${process.env.BACKEND_URL}/auth/facebook/callback` +
        `&client_secret=${process.env.FACEBOOK_APP_SECRET}` +
        `&code=${code}`
    );

    const accessToken = tokenRes.data.access_token;

    // 🔹 Fetch user info from Facebook
    const userRes = await axios.get(
      `https://graph.facebook.com/me?fields=first_name,last_name,email&access_token=${accessToken}`
    );

    const fbUser = userRes.data;
    // console.log("🔹 Facebook user info:", fbUser);

    if (!fbUser.email) {
      console.error("❌ No email found in Facebook response");
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=no_email`);
    }

    // 🔹 Call login stored procedure
    // console.log("🔹 Checking user in DB:", fbUser.email);
    const result = await client.query(
      "CALL ins.usp_login_user($1::VARCHAR, $2::JSON, $3::BOOLEAN, $4::TEXT);",
      [fbUser.email, null, null, null]
    );

    const dbResponse = result.rows[0];
    const user = dbResponse?.p_loginuser;
    // ✅ Ensure fullname is always set
if (user) {
  user.fullname =
    user.fullname || 
    `${user.firstname || ""} ${user.lastname || ""}`.trim() || 
    `${fbUser.first_name || ""} ${fbUser.last_name || ""}`.trim() || 
    "User";
}

    const p_status = dbResponse?.p_status;
    const p_message = dbResponse?.p_message;

    // 🔸 If user is not registered — redirect to role selection
    if (!user || user.code === "NOTREGISTERED") {
      const redirectUrl = `${process.env.FRONTEND_URL}/roledefault?email=${encodeURIComponent(
        fbUser.email
      )}&firstName=${encodeURIComponent(fbUser.first_name || "")}&lastName=${encodeURIComponent(
        fbUser.last_name || ""
      )}&roleId=${selectedRole || ""}`;
      // console.log("🔸 Redirecting to signup role page:", redirectUrl);
      return res.redirect(redirectUrl);
    }

    if (!p_status) {
      console.error("❌ Facebook login SP failed:", p_message);
      return res.redirect(
        `${process.env.FRONTEND_URL}/login?error=${encodeURIComponent(p_message)}`
      );
    }

    // 🔹 Generate JWT token
    const token = generateToken({
  id: user.userid,
  role: user.roleid,
  firstName: user.firstname || fbUser.first_name || "",
  lastName: user.lastname || fbUser.last_name || "",
  email: user.email,
  name: user.fullname, // ✅ Include fullname
});


    const redirectUrl = `${process.env.FRONTEND_URL}/login?` +
  `token=${token}` +
  `&userId=${user.userid}` +
  `&roleId=${user.roleid}` +
  `&firstName=${encodeURIComponent(user.firstname || fbUser.first_name || "")}` +
  `&lastName=${encodeURIComponent(user.lastname || fbUser.last_name || "")}` +
  `&email=${encodeURIComponent(user.email)}` +
  `&name=${encodeURIComponent(user.fullname)}` + // ✅ send fullname
  `&p_code=${encodeURIComponent(user.code)}` +
  `&p_message=${encodeURIComponent(user.message)}`;


    // console.log("✅ Redirecting to frontend:", redirectUrl);
    return res.redirect(redirectUrl);
  } catch (error) {
    console.error("❌ Facebook Login Error:", error.message);
    return res.redirect(`${process.env.FRONTEND_URL}/login?error=facebook_login_failed`);
  }
}




// import { client } from '../config/Db.js';
// import { google } from 'googleapis';
// import { generateToken } from '../utils/Jwt.js';
// import bcrypt from 'bcrypt';
// import dotenv from 'dotenv';
// import axios from 'axios';
// dotenv.config();

// async function getUserByEmail(email) {
//   const result = await client.query(
//     "SELECT * FROM ins.fn_get_loginpassword($1)",
//     [email]
//   );
//   return result.rows[0];
// }

// async function createUser(data) {
//   const { firstname, lastname, email, passwordhash, roleId } = data;

//   const result = await client.query(
//     `CALL ins.usp_insert_user(
//       $1::VARCHAR,  
//       $2::VARCHAR,  
//       $3::VARCHAR,  
//       $4::VARCHAR,  
//       $5::BOOLEAN,  
//       $6::SMALLINT, 
//       NULL,         
//       NULL,         
//       NULL          
//     )`,
//     [firstname, lastname, email, passwordhash, true, roleId]
//   );

//   const { p_code, p_message } = result.rows[0] || {};
//   return { p_code, p_message };
// }

// // ✅ Google OAuth Redirect
// export async function getGoogleLoginPage(req, res) {
//   try {
//     const { roleid } = req.query;

//     const redirectUrl =
//       `https://accounts.google.com/o/oauth2/v2/auth?` +
//       `client_id=${process.env.GOOGLE_CLIENT_ID}` +
//       `&redirect_uri=${process.env.BACKEND_URL}/auth/google/callback` +
//       `&response_type=code` +
//       `&scope=openid email profile`;

//     // role cookie store
//     res.cookie("selected_role", roleid || 1, {
//       maxAge: 10 * 60 * 1000,
//       httpOnly: true,
//       secure: false,
//       sameSite: "lax",
//     });

//     res.redirect(redirectUrl);
//   } catch (err) {
//     console.error("[ERROR] getGoogleLoginPage:", err);
//     res.status(500).json({ message: "Server error generating Google login" });
//   }
// }

// // ✅ Google OAuth Callback
// export async function getGoogleLoginCallback(req, res) {
//   const { code } = req.query;
//   const selectedRole = req.cookies["selected_role"];

//   if (!code) {
//     console.error("[ERROR] Invalid Google login attempt");
//     return res.status(401).json({ message: "Invalid Google login attempt" });
//   }

//   try {
//     const oauth2Client = new google.auth.OAuth2(
//       process.env.GOOGLE_CLIENT_ID,
//       process.env.GOOGLE_CLIENT_SECRET,
//       `${process.env.BACKEND_URL}/auth/google/callback`
//     );

//     // token exchange
//     const { tokens } = await oauth2Client.getToken(code);
//     oauth2Client.setCredentials(tokens);

//     const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
//     const { data } = await oauth2.userinfo.get();

//     // DB check
//     let user = await getUserByEmail(data.email);

//     if (!user) {
//       const redirectUrl = `${process.env.FRONTEND_URL}/roledefault?email=${encodeURIComponent(
//         data.email
//       )}&firstName=${encodeURIComponent(data.given_name || "")}&lastName=${encodeURIComponent(
//         data.family_name || ""
//       )}&roleId=${selectedRole || ""}`;

//       return res.redirect(redirectUrl);
//     }

//     // user already exist → JWT token generate
//     const token = generateToken({
//       id: user.userid,
//       role: user.roleid,
//       firstName: user.firstname,
//       lastName: user.lastname,
//       email: user.email,
//     });

//     const redirectUrl = `${process.env.FRONTEND_URL}/login?token=${token}&userId=${user.userid}&roleId=${user.roleid}&firstName=${encodeURIComponent(
//       user.firstname
//     )}&lastName=${encodeURIComponent(user.lastname)}&email=${encodeURIComponent(
//       user.email
//     )}`;

//     res.redirect(redirectUrl);
//   } catch (err) {
//     console.error("[ERROR] Google login callback failed:", err);
//     return res
//       .status(500)
//       .json({ message: "Server error during Google login" });
//   }
// }

// // ✅ Set Password After Google Signup
// export async function setPasswordAfterGoogleSignup(req, res) {
//   try {
//     const { email, firstName, lastName, roleId, password } = req.body;

//     if (!email || !password || !roleId) {
//       return res.status(400).json({ message: "Missing required fields" });
//     }

//     const existingUser = await getUserByEmail(email);
//     if (existingUser) {
//       return res
//         .status(400)
//         .json({ message: "User already exists, please login" });
//     }

//     const hashedPassword = await bcrypt.hash(password, 10);
//     await createUser({
//       firstname: firstName || "",
//       lastname: lastName || "",
//       email,
//       passwordhash: hashedPassword,
//       roleId,
//     });

//     const user = await getUserByEmail(email);
//     const token = generateToken({
//       id: user.userid,
//       role: user.roleid,
//       firstName: user.firstname,
//       lastName: user.lastname,
//       email: user.email,
//     });

//     return res.status(201).json({
//       success: true,
//       message: "Signup completed successfully",
//       token,
//       user: {
//         id: user.userid,
//         role: user.roleid,
//         firstName: user.firstname,
//         lastName: user.lastname,
//         email: user.email,
//       },
//     });
//   } catch (err) {
//     console.error("[ERROR] setPasswordAfterGoogleSignup failed:", err);
//     return res
//       .status(500)
//       .json({ message: "Server error while creating user" });
//   }
// }

// // ✅ Facebook OAuth Redirect
// export async function getFacebookLoginPage(req, res) {
//   try {
//     const { roleid } = req.query;

//     const redirectUrl =
//       `https://www.facebook.com/v23.0/dialog/oauth?` +
//       `client_id=${process.env.FACEBOOK_APP_ID}` +
//       `&redirect_uri=${process.env.BACKEND_URL}/auth/facebook/callback` +
//       `&scope=email,public_profile`;

//     res.cookie("selected_role", roleid, {
//     maxAge: 10 * 60 * 1000,
//     httpOnly: true,
//     secure: true,
//     sameSite: "none",
//   });


//     res.redirect(redirectUrl);
//   } catch (err) {
//     console.error("[ERROR] getFacebookLoginPage:", err);
//     res.status(500).json({ message: "Server error generating Facebook login" });
//   }
// }

// // ✅ Facebook OAuth Callback
// export async function getFacebookLoginCallback(req, res) {
//   const { code, err } = req.query;
//   const selectedRole = req.cookies["selected_role"];

//   if (err || !code) {
//     console.warn("[INFO] Facebook login canceled or invalid attempt");
//     return res.redirect(`${process.env.FRONTEND_URL}/login/`);
//   }

//   try {
//     // Exchange code for access token
//     const tokenRes = await axios.get(
//       `https://graph.facebook.com/v23.0/oauth/access_token?` +
//         `client_id=${process.env.FACEBOOK_APP_ID}` +
//         `&redirect_uri=${process.env.BACKEND_URL}/auth/facebook/callback` +
//         `&client_secret=${process.env.FACEBOOK_APP_SECRET}` +
//         `&code=${code}`
//     );

//     const accessToken = tokenRes.data.access_token;

//     // Fetch user info
//     const userRes = await axios.get(
//       `https://graph.facebook.com/me?fields=first_name,last_name,email&access_token=${accessToken}`
//     );

//     const fbUser = userRes.data;
//     if (!fbUser.email) {
//       return res
//         .status(400)
//         .json({ message: "Facebook login failed: no email found" });
//     }

//     let user = await getUserByEmail(fbUser.email);

//     if (!user) {
//       const redirectUrl = `${process.env.FRONTEND_URL}/roledefault?email=${encodeURIComponent(
//         fbUser.email
//       )}&firstName=${encodeURIComponent(
//         fbUser.first_name || ""
//       )}&lastName=${encodeURIComponent(fbUser.last_name || "")}&roleId=${
//         selectedRole || ""
//       }`;
//       return res.redirect(redirectUrl);
//     }

//     const token = generateToken({
//       id: user.userid,
//       role: user.roleid,
//       firstName: user.firstname,
//       lastName: user.lastname,
//       email: user.email,
//     });

//     const redirectUrl = `${process.env.FRONTEND_URL}/login?token=${token}&userId=${user.userid}&roleId=${user.roleid}&firstName=${encodeURIComponent(
//       user.firstname
//     )}&lastName=${encodeURIComponent(user.lastname)}&email=${encodeURIComponent(
//       fbUser.email
//     )}`;

//     res.redirect(redirectUrl);
//   } catch (err) {
//     console.error("[ERROR] Facebook login callback failed:", err);
//     return res.redirect(`${process.env.FRONTEND_URL}/login/`);
//   }
// }

