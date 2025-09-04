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

//Changes For Apple Id Login

// import { Router } from 'express';
// import passport from 'passport';
// import { loginSuccess, loginFailure, logout } from '../controller/AuthController.js';

// const router = Router();

// router.get('/apple', (req, res, next) => {
//   console.log('GET /auth/apple route accessed');
//   next();
// }, passport.authenticate('apple'));

// router.post('/apple/callback',
//   passport.authenticate('apple', {
//     successRedirect: '/auth/success',
//     failureRedirect: '/auth/failure',
//   })
// );

// router.get('/success', loginSuccess);
// router.get('/failure', loginFailure);
// router.get('/logout', logout);

// export default router;


