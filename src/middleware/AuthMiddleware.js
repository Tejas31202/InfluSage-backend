import jwt from "jsonwebtoken";


 
const JWT_SECRET = process.env.JWT_SECRET;
//Changes For Role Base Auth..
const roleMap = {
  1: 'Influencer',
  2: 'Vendor',
  3: 'Agency'
}
 
//Changes For Role Based Auth..
const authenticateUser = (allowedRoles = []) => {
  return (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Authorization header missing or malformed" });
    }
    const token = authHeader.split(" ")[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
 
      //Changes For Role Base Auth..
 
     
      const userRoleName = roleMap[decoded.role];
 
      if (!userRoleName) {
        return res.status(403).json({ message: 'Invalid role in token' });
      }
 
      if (allowedRoles.length > 0 && !allowedRoles.includes(userRoleName)) {
        return res.status(403).json({ message: 'Access denied: insufficient role' });
      }
 
      next();
    } catch (error) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }
  };
}
 
export default authenticateUser;