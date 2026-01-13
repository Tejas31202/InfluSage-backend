import dotenv from "dotenv";
dotenv.config();
import nodemailer from "nodemailer";
import { getSenderEmail } from "../controller/CommonController.js";

export async function sendingMail(to, subject, htmlContent) {
  const senderEmail = await getSenderEmail();   

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: senderEmail,              
      pass: process.env.EMAIL_PASS,    
    },
  });

  await transporter.sendMail({
    from: senderEmail,                 
    to,
    subject,
    html: htmlContent,
  });
}

export async function sendingMailFormatForAdmin(to, subject, html) {
  const senderEmail = await getSenderEmail();

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: senderEmail,
      pass: process.env.EMAIL_PASS,
    },
  });

  await transporter.sendMail({
    from: senderEmail,
    to,
    subject,
    html,
  });
}
