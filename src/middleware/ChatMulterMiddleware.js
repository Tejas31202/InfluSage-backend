import multer from "multer";
import path from "path";
import fs from "fs";

// const storage = multer.diskStorage({
//   destination: function (req, file, cb) {
//     const roleId = req.body.p_roleid || req.query.p_roleid;
//     let uploadPath = "src/uploads/common";

//     if (roleId == 1) {
//       uploadPath = "src/uploads/influencer";
//     } else if (roleId == 2) {
//       uploadPath = "src/uploads/vendor";
//     }

//     if (!fs.existsSync(uploadPath)) {
//       fs.mkdirSync(uploadPath, { recursive: true });
//     }

//     cb(null, uploadPath);
//   },
//   filename: function (req, file, cb) {
//     const ext = path.extname(file.originalname);

//     // username resolveUsername middleware 
//     const username = req.username?.toLowerCase() || "user";

    
//     let roleName = "common";
//     if (req.body.p_roleid == 1) {
//       roleName = "influencer";
//     } else if (req.body.p_roleid == 2) {
//       roleName = "vendor";
//     }

  
//     const timestamp = Date.now();
//     const finalName = `${username}_chat_${timestamp}${ext}`;

//     cb(null, finalName);
//   },
// });


const storage = multer.memoryStorage(); // store in memory


export const chatupload = multer({ storage });
