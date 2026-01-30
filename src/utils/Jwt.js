import jwt from "jsonwebtoken";

export const generateAccessToken = (user) => {
  return jwt.sign(
    {
      id: user.userid,
      email: user.email,
      role: user.roleid,
      name: user.fullname,
      p_code: user.code,
    },
    process.env.JWT_SECRET,
    { expiresIn: "1h" } // short-lived
  );
};

// Refresh token (stateless, long-lived)
export const generateRefreshToken = (user) => {
  return jwt.sign(
    {
      id: user.userid,
      email: user.email,
      role: user.roleid,
      name: user.fullname,
      p_code: user.code,
    },
    process.env.REFRESH_SECRET, // separate secret for refresh token
    { expiresIn: "3h" } // long-lived
  );
};

