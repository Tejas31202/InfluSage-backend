// import express from 'express';
// import passport from 'passport';

// const router = express.Router();

// // Login with Google
// router.get(
//   '/google',
//   passport.authenticate('google', { scope: ['profile', 'email'] })
// );

// // Google OAuth callback
// router.get(
//   '/google/callback',
//   passport.authenticate('google', { failureRedirect: '/', session: true }),
//   async (req, res) => {
//     // Successful login
//     res.redirect('/profile');
//   }
// );

// // Logout
// router.get('/logout', async (req, res, next) => {
//   try {
//     await new Promise((resolve, reject) => {
//       req.logOut({ keepSessionInfo: false }, (err) => {
//         if (err) reject(err);
//         else resolve();
//       });
//     });
//     res.redirect('/');
//   } catch (error) {
//     next(error);
//   }
// });

// export default router;



// import express from "express";
// import { authGoogle, authGoogleCallback } from "../controller/AuthController.js";

// const routes = express.Router();

// // Start Google login
// routes.get("/auth/google", authGoogle);

// // Google OAuth callback
// routes.get("/auth/google/callback", authGoogleCallback);

// export default routes;

// src/routes/AuthRoutes.js


//Changes  For Apple Id Login
// import express from 'express';
// import { appleLogin, appleCallback } from '../controller/AuthController.js';

// const routes = express.Router();

// // Apple Sign In
// routes.get('/apple', appleLogin);
// routes.post('/apple/callback', appleCallback);

// export default routes;
