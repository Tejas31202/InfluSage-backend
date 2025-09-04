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


