import { Resend } from "resend";
const resend = new Resend(process.env.RESEND_API_KEY);

async function sendingMail(to, subject, otp) {
  try {
    await resend.emails.send({
      from: "InfluSage <influsage.dev@gmail.com>",
      to,
      subject,
      html: `
        <h3>InfluSage Verification Code</h3>
        <p>Your OTP is: <strong style="font-size:24px;">${otp}</strong></p>
        <p>This code will expire in 10 minutes.</p>
      `,
    });
    console.log("✅ Mail sent successfully via Resend");
  } catch (error) {
    console.error("❌ Mail sending failed via Resend:", error);
    throw new Error("Failed to send email");
  }
}

export default sendingMail;
