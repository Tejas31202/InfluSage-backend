import multer from 'multer';
import path from 'path';
import fs from 'fs';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "src/uploads/influencer/");
  },
  filename: (req, file, cb) => {
    const username = (req.user?.name || req.body.username || "user")
      .replace(/\s+/g, "_")
      .toLowerCase();

    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    let prefix = "file";

    if (file.fieldname === "photo") prefix = "up";
    if (file.fieldname === "portfolioFiles") prefix = "portfoliofile";

    cb(
      null,
      `${username}_${prefix}_${uniqueSuffix}${path.extname(file.originalname)}`
    );
  },
});

export const upload = multer({ storage });
