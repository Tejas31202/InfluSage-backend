import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export async function sendingMail(to, subject, otp) {
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject,
    html: `
      <h3>InfluSage Verification Code</h3>
      <p>Your OTP is: <strong style="font-size:24px;">${otp}</strong></p>
      <p>This code will expire in 10 minutes.</p>
    `,
  });
}

// export default sendingMail;

export async function sendingMailFormatForAdmin(to,subject,html){
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject,
    html
  })
}
