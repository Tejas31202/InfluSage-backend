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


