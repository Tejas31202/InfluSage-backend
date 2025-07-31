import express from 'express';
import passport from 'passport';

const router = express.Router();

// Google
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/google/callback', passport.authenticate('google', { session: false }), (req, res) => {
  res.json({ message: 'Google Login Success', user: req.user });
});

// Facebook
router.get('/facebook', passport.authenticate('facebook', { scope: ['email'] }));
router.get('/facebook/callback', passport.authenticate('facebook', { session: false }), (req, res) => {
  res.json({ message: 'Facebook Login Success', user: req.user });
});

// Apple
router.get('/apple', passport.authenticate('apple'));
router.post('/apple/callback', passport.authenticate('apple', { session: false }), (req, res) => {
  res.json({ message: 'Apple Login Success', user: req.user });
});

export default router;
