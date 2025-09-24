import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { client } from '../config/Db.js';


const UPLOAD_DIR = path.join("src", "uploads", "influencer");
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// ✅ Helper to get username
const getUsername = async (req) => {
  if (req.user?.firstName || req.user?.lastName) {
    return `${req.user.firstName || ""}_${req.user.lastName || ""}`.trim();
  } else if (req.body?.firstName || req.body?.lastName) {
    return `${req.body.firstName || ""}_${req.body.lastName || ""}`.trim();
  } else if (req.user?.id) {
    const { rows } = await client.query(
      "SELECT firstname, lastname FROM ins.users WHERE id=$1",
      [req.user.id]
    );
    if (rows[0]) return `${rows[0].firstname || ""}_${rows[0].lastname || ""}`.trim();
  }
  return "user";
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: async (req, file, cb) => {
    try {
      // Get username and sanitize
      let username = (await getUsername(req))
        .replace(/\s+/g, "_")
        .replace(/[^a-z0-9_]/gi, "")
        .toLowerCase();

      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);

      // Map fieldname to prefix
      const prefixMap = {
        photo: "up",
        portfolioFiles: "portfoliofile",
      };
      const prefix = prefixMap[file.fieldname] || "file";

      cb(null, `${username}_${prefix}_${uniqueSuffix}${path.extname(file.originalname)}`);
    } catch (err) {
      cb(err);
    }
  },
});

export const upload = multer({ storage});