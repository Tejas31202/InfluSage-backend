// 📁 utils/MailUtils.js
import dotenv from 'dotenv';
import sgMail from '@sendgrid/mail';

dotenv.config();

// Set API key from environment
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

/**
* Generic mail sender
*/
export const sendingMail = async (toEmail, subject, htmlContent) => {
  try {
    const msg = {
      to: toEmail,
      from: {
        email: process.env.SENDER_EMAIL, // must be verified in SendGrid
        name: 'InfluSage',
      },
      subject,
      html: htmlContent,
    };

    const response = await sgMail.send(msg);
    return response;

  } catch (error) {
    // ✅ Proper SendGrid error handling
    if (error.response?.body?.errors) {
      console.error(
        '❌ SendGrid Errors:',
        error.response.body.errors
      );
    } else {
      console.error('❌ Email Error:', error.message);
    }

    throw new Error('Failed to send email');
  }
};

/**
* Admin mail wrapper (if you want separate naming)
*/
export const sendingMailFormatForAdmin = async (to, subject, html) => {
  return sendingMail(to, subject, html);
};

export default sendingMail;