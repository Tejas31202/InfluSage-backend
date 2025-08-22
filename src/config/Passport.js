import passport from "passport";
import GoogleStrategy from "passport-google-oauth2";
import client from "../config/db.js";

passport.use("google", new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "http://localhost:3001/auth/google/callback",
  // userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
}, async (accessToken, refreshToken, profile, cb) => {
  try {
    const result = await client.query("SELECT * FROM ins.users WHERE email = $1", [profile.email]);
    if (result.rows.length === 0) {
      // Insert new user
      const newUser = await client.query(
        "INSERT INTO users (email, google_id, name) VALUES ($1, $2, $3) RETURNING *",
        [profile.email, profile.id, profile.displayName]
      );
      return cb(null, newUser.rows[0]);
    } else {
      return cb(null, result.rows[0]);
    }
  } catch (err) {
    return cb(err);
  }
}));

passport.serializeUser((user, cb) => cb(null, user));
passport.deserializeUser((user, cb) => cb(null, user));
