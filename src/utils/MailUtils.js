// utils/MailUtils.js
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  Host: "smtp.elasticemail.com",
  Ports: 2525,
  service: "gmail",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendingMail = async (to, subject, htmlContent) => {
  try {
    const info = await transporter.sendMail({
      from: `"InfluSage" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html: htmlContent,
    });
    console.log("✅ Mail sent successfully:", info.response);
  } catch (error) {
    console.error("❌ Mail sending failed:", error);
    throw new Error("Failed to send email");
  }
};

export default sendingMail;

