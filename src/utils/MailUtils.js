import dotenv from "dotenv";
dotenv.config();
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export async function sendingMail(to, subject,htmlContent) {
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject,
    html:htmlContent,
  });
}

export async function sendingMailFormatForAdmin(to,subject,html){
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject,
    html
  })
}
 