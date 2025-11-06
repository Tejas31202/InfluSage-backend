// 📁 utils/MailUtils.js
import dotenv from 'dotenv';
import sgMail from '@sendgrid/mail';

dotenv.config();

// Set API key from environment
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

export async function sendingMailFormatForAdmin(to,subject,html){
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject,
    html
  })
}

export const sendingMail = async (toEmail, subject, htmlContent) => {
  try {
    const msg = {
      to: toEmail,
      from: {
        email: process.env.SENDER_EMAIL, // must be verified in SendGrid
        name: 'InfluSage', // optional display name
      },
      subject: subject,
      html: htmlContent,
    };

    const response = await sgMail.send(msg);
    // console.log('✅ Email sent successfully to:', toEmail);
    return response;
  } catch (error) {
    console.error('❌ Error sending email:', error.response?.body || error.message);
    throw error;
  }
};

export default sendingMail;