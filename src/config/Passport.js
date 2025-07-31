import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import AppleStrategy from 'passport-apple';
import pool from './db.js';
const generateToken = require ('../utils/jwt.js');

const saveOrUpdateUser = async (email, name, provider) => {
  const query = 'SELECT * FROM sp_login_social_user($1, $2, $3)';
  const values = [email, name, provider];
  const result = await pool.query(query, values);
  const user = result.rows[0];
  const token = generateToken({ id: user.id, email: user.email, name: user.full_name });
  return { ...user, token };
};

// Google
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: '/auth/google/callback'
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const email = profile.emails?.[0]?.value;
    const name = profile.displayName;
    const user = await saveOrUpdateUser(email, name, 'google');
    done(null, user);
  } catch (err) {
    done(err, null);
  }
}));

// Facebook
passport.use(new FacebookStrategy({
  clientID: process.env.FB_CLIENT_ID,
  clientSecret: process.env.FB_CLIENT_SECRET,
  callbackURL: '/auth/facebook/callback',
  profileFields: ['id', 'displayName', 'emails']
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const email = profile.emails?.[0]?.value;
    const name = profile.displayName;
    const user = await saveOrUpdateUser(email, name, 'facebook');
    done(null, user);
  } catch (err) {
    done(err, null);
  }
}));

// Apple (simplified)
passport.use(new AppleStrategy({
  clientID: process.env.APPLE_CLIENT_ID,
  teamID: process.env.APPLE_TEAM_ID,
  keyID: process.env.APPLE_KEY_ID,
  privateKeyString: process.env.APPLE_PRIVATE_KEY,
  callbackURL: '/auth/apple/callback',
  passReqToCallback: true
}, async (req, accessToken, refreshToken, idToken, profile, done) => {
  try {
    const email = idToken.email;
    const name = profile?.name || email?.split('@')[0];
    const user = await saveOrUpdateUser(email, name, 'apple');
    done(null, user);
  } catch (err) {
    done(err, null);
  }
}));
