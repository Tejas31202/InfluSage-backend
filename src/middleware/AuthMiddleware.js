import jwt, { decode } from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.REFRESH_SECRET;

// Role mapping
const roleMap = {
  1: "Influencer",
  2: "Vendor",
  3: "Agency",
  4: "Admin",
};

const authenticateUser = (allowedRoles = []) => {
  return async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Authorization header missing or malformed",
      });
    }

    const token = authHeader.split(" ")[1];

    // Function to verify token
    const verifyToken = (token, secret) => {
      try {
        return jwt.verify(token, secret);
      } catch (err) {
        return null;
      }
    };

    // 1️⃣ Try access token first
    let decoded = token ? verifyToken(token, JWT_SECRET) : null;

    // 2️⃣ If access token invalid/expired → check refresh token cookie
    // authenticateUser middleware ke andar
if (!decoded) {
  const refreshToken = req.cookies?.refreshToken;
  if (!refreshToken) {
    return res.status(401).json({ message: "Login required" });
  }

  const payload = jwt.verify(refreshToken, process.env.REFRESH_SECRET);

  // ✅ 1. NEW ACCESS TOKEN
  const newAccessToken = jwt.sign(
    {
      id: payload.id,
      email: payload.email,
      role: payload.role,
      name: payload.name,
      p_code: payload.p_code,
    },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );

  // ✅ 2. ROTATE REFRESH TOKEN (IMPORTANT)
  const newRefreshToken = jwt.sign(
    {
      id: payload.id,
      email: payload.email,
      role: payload.role,
      name: payload.name,
      p_code: payload.p_code,
    },
    process.env.REFRESH_SECRET,
    { expiresIn: "3h" }
  );

  //  3. COOKIE UPDATE
  res.cookie("refreshToken", newRefreshToken, {
    httpOnly: true,
    secure: true,          // prod me true
    sameSite: "Strict",
    maxAge: 3 * 60 * 60 * 1000, // 3 hours
  });

  //  4. SEND ACCESS TOKEN BACK
  res.setHeader("x-access-token", newAccessToken);

  decoded = payload; // continue request
}


    // Optional: fetch user data from decoded or your DB if needed
    const userRoleName = roleMap[decoded.role] || decoded.roleName || "Vendor";

    if (!userRoleName) {
      return res.status(403).json({ message: "Invalid role in token" });
    }

    // Role restriction check
    if (allowedRoles.length > 0 && !allowedRoles.includes(userRoleName)) {
      return res
        .status(403)
        .json({ message: "Access denied: insufficient role" });
    }

    // Blocked user check
    if (decoded.p_code === "BLOCKED") {
      return res.status(403).json({
        message: "Blocked user is not allowed to access APIs.",
      });
    }

    console.log("Access token:", token);
console.log("Decoded access token:", decoded);
console.log("Refresh token from cookie:", req.cookies?.refreshToken);

    // Attach user info
    req.user = {
      id: decoded.id,
      role: userRoleName,
      p_code: decoded.p_code,
      email: decoded.email,
    };

    next();
  };
};

export default authenticateUser;
