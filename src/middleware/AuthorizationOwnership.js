import { client } from "../config/Db.js"; // PostgreSQL client

export const authorizeOwnership = ({ idParam }) => {
  return async (req, res, next) => {
    try {
      const campaignId = req.params[idParam];
      const userId = req.user.id;

      //  Admin bypass
      if (req.user.role === "Admin") {
        return next();
      }

      //  Call PostgreSQL authorization function
      const result = await client.query(
        `SELECT ins.fn_get_campaignauthorization($1, $2) AS authmsg`,
        [userId, campaignId]
      );

      const authMsg = result.rows[0]?.authmsg;

      //  Unauthorized condition (based on function message)
      if (
        authMsg &&
        authMsg.toLowerCase().includes("access denied")
      ) {
        return res.status(403).json({
          message: "Unauthorized access",
          detail: authMsg,
        });
      }

      //  Allowed → continue
      next();

    } catch (err) {
      console.error("Authorization error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  };
};




export default authorizeOwnership;

