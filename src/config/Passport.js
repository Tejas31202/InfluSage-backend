
// import passport from 'passport';
// import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
// import 'dotenv/config'; //  Must be the first import

// passport.use(
//   new GoogleStrategy(
//     {
//       clientID: process.env.GOOGLE_CLIENT_ID,
//       clientSecret: process.env.GOOGLE_CLIENT_SECRET,
//       callbackURL: 'http://localhost:3001/auth/google/callback',
//     },
//     async (accessToken, refreshToken, profile, done) => {
//       try {
//         // TODO: Save the user to DB here if needed
//         return done(null, profile);
//       } catch (error) {
//         return done(error, null);
//       }
//     }
//   )
// );

// // Store only minimal info in session
// passport.serializeUser((user, done) => {
//   done(null, { id: user.id, displayName: user.displayName, emails: user.emails });
// });

// passport.deserializeUser((user, done) => {
//   done(null, user);
// });

//Changes Before File
// import passport from "passport";
// import GoogleStrategy from "passport-google-oauth2";
// const AppleStrategy = require('passport-apple');
// import client from "../config/db.js";


//Changes For Apple Id Login

// import passport from 'passport';
// import MockStrategy from 'passport-mock-strategy';

// const useMock = process.env.USE_MOCK_APPLE === 'true';

// if (useMock) {
//   passport.use(new MockStrategy({
//     name: 'apple', // 👈 must match 'apple' string used in route
//     user: {
//       id: 'mock-user-id',
//       email: 'mockuser@example.com',
//       name: {
//         firstName: 'Mock',
//         lastName: 'User'
//       }
//     }
//   }, (user, done) => {
//     done(null, user);
//   }));
// }

// passport.serializeUser((user, done) => {
//   done(null, user);
// });

// passport.deserializeUser((user, done) => {
//   done(null, user);
// });


