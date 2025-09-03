//Changes Before File
// import passport from "passport";
// import GoogleStrategy from "passport-google-oauth2";
// const AppleStrategy = require('passport-apple');
// import client from "../config/db.js";


//Changes Before File
// passport.use("google", new GoogleStrategy({
//   clientID: process.env.GOOGLE_CLIENT_ID,
//   clientSecret: process.env.GOOGLE_CLIENT_SECRET,
//   callbackURL: "http://localhost:3001/auth/google/callback",
//   // userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
// }, async (accessToken, refreshToken, profile, cb) => {
//   try {
//     const result = await client.query("SELECT * FROM ins.users WHERE email = $1", [profile.email]);
//     if (result.rows.length === 0) {
//       // Insert new user
//       const newUser = await client.query(
//         "INSERT INTO users (email, google_id, name) VALUES ($1, $2, $3) RETURNING *",
//         [profile.email, profile.id, profile.displayName]
//       );
//       return cb(null, newUser.rows[0]);
//     } else {
//       return cb(null, result.rows[0]);
//     }
//   } catch (err) {
//     return cb(err);
//   }
// }));

// passport.serializeUser((user, cb) => cb(null, user));
// passport.deserializeUser((user, cb) => cb(null, user));


//Changes For AppleId Login 

//Changes For AppleId


// Convert Apple private key to correct format
// const privateKey = process.env.APPLE_PRIVATE_KEY.replace(/\\n/g, '\n');


//Changes For AppleId Login

// import passport from "passport";
// import AppleStrategy from "passport-apple";
// import client from "../config/db.js";

// const privateKey = process.env.APPLE_PRIVATE_KEY_PATH;

// // Apple Strategy Configuration
// passport.use(new AppleStrategy({
//   clientID: process.env.APPLE_CLIENT_ID,
//   teamID: process.env.APPLE_TEAM_ID,
//   keyID: process.env.APPLE_KEY_ID,
//   privateKey: privateKey,
//   callbackURL: "http://localhost:3001/api/auth/apple/callback",
//   passReqToCallback: true,
// }, async (req, accessToken, refreshToken, idToken, profile, done) => {
//   try {
//     const appleId = idToken.sub;
//     const email = idToken.email;

//     // First check by Apple ID (more secure than email)
//     let result = await client.query(
//       "SELECT * FROM ins.users WHERE apple_id = $1",
//       [appleId]
//     );

//     let user;

//     if (result.rows.length > 0) {
//       // Existing user found by Apple ID
//       user = result.rows[0];
//     } else {
//       // Try finding by email if Apple ID not found
//       const emailResult = await client.query(
//         "SELECT * FROM ins.users WHERE email = $1",
//         [email]
//       );

//       if (emailResult.rows.length > 0) {
//         // Update existing user with Apple ID
//         user = emailResult.rows[0];
//         await client.query(
//           "UPDATE ins.users SET apple_id = $1 WHERE id = $2",
//           [appleId, user.id]
//         );
//       } else {
//         // Create new user
//         const firstName = profile?.name?.firstName || '';
//         const lastName = profile?.name?.lastName || '';

//         const insert = await client.query(`
//           INSERT INTO ins.users (firstname, lastname, email, apple_id, isemailverified, createddate)
//           VALUES ($1, $2, $3, $4, $5, NOW())
//           RETURNING *
//         `, [firstName, lastName, email, appleId, true]);

//         user = insert.rows[0];
//       }
//     }

//     return done(null, user);
//   } catch (err) {
//     console.error("Error in AppleStrategy:", err);
//     return done(err, null);
//   }
// }));

// // Serialize/Deserialize user for sessions

// passport.serializeUser((user, done) => {
//   done(null, user.id); // store only user ID in session
// });

// passport.deserializeUser(async (id, done) => {
//   try {
//     const result = await client.query(
//       "SELECT * FROM ins.users WHERE id = $1",
//       [id]
//     );
//     done(null, result.rows[0]);
//   } catch (err) {
//     done(err, null);
//   }
// });
