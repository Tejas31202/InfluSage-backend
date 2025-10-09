import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendingMail(to, subject, otp) {
  try {
    const info = await transporter.sendMail({
      from: `"InfluSage" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html: `
        <h3>InfluSage Verification Code</h3>
        <p>Your OTP is: <strong style="font-size:24px;">${otp}</strong></p>
        <p>This code will expire in 10 minutes.</p>
      `,
    });
    console.log("✅ Mail sent successfully:", info.messageId);
  } catch (error) {
    console.error("❌ Mail sending failed:", error);
    throw new Error("Failed to send email");
  }
}

export default sendingMail;
