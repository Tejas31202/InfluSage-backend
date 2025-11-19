import jwt from "jsonwebtoken";
import { client } from "../config/Db.js"; // PostgreSQL client

const JWT_SECRET = process.env.JWT_SECRET;

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

    try {
      // Verify JWT
      const decoded = jwt.verify(token, JWT_SECRET);

      const userRoleName = roleMap[decoded.role];

      if (!userRoleName) {
        return res.status(403).json({ message: "Invalid role in token" });
      }

      // Role restriction check
      if (allowedRoles.length > 0 && !allowedRoles.includes(userRoleName)) {
        return res
          .status(403)
          .json({ message: "Access denied: insufficient role" });
      }

      // Fetch user from DB
      const result = await client.query(
        `SELECT id, userstatusid, isdelete 
         FROM ins.users 
         WHERE id = $1`,
        [decoded.id]
      );

      if (result.rows.length === 0) {
        return res.status(403).json({ message: "User not found" });
      }

      const user = result.rows[0];

      // Blocked or Deleted check
      if (user.userstatusid === 22 || user.isdelete === true) {
        return res.status(403).json({ message: "User not authorized" });
      }

      // Attach user info
      req.user = {
        id: user.id,
        role: userRoleName,
        p_code: decoded.p_code
      };

      next();
    } catch (error) {
      console.error("JWT Verify Error:", error.message);
      return res.status(401).json({ message: "Invalid or expired token" });
    }
  };
};

export default authenticateUser;
