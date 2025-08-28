import multer from "multer";
import path from "path";
import fs from "fs";

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Sirf vendor folder
    const dir = path.join(process.cwd(), "src/uploads/vendor/");

    // folder create agar nahi hai
    fs.mkdirSync(dir, { recursive: true });

    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const username = req.user?.name || "vendor"; 
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);

    // spaces replace kar do original name me
    const sanitizedOriginalName = path
      .basename(file.originalname, ext)
      .replace(/\s+/g, "_");

    // final filename
    const finalName = `${sanitizedOriginalName}_${username}_${timestamp}${ext}`;
    cb(null, finalName);
  },
});


export const upload = multer({ storage });
