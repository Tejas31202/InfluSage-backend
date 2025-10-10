import SibApiV3Sdk from 'sib-api-v3-sdk';
import dotenv from 'dotenv';

dotenv.config();

// configure API key
const client = SibApiV3Sdk.ApiClient.instance;
const apiKeyAuth = client.authentications['api-key'];
apiKeyAuth.apiKey = process.env.BREVO_API_KEY;

const tranEmailApi = new SibApiV3Sdk.TransactionalEmailsApi();

export const sendMail = async (toEmail, subject, htmlContent) => {
  try {
    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail({
      sender: { email: 'noreply@influsage.dev', name: 'Your App' },
      to: [{ email: toEmail }],
      subject: subject,
      htmlContent: htmlContent,
    });

    const response = await tranEmailApi.sendTransacEmail(sendSmtpEmail);
    console.log('✅ Email sent:', response.messageId);
    return response;
  } catch (error) {
    console.error('❌ Email error:', error);
    throw error;
  }
};

export default sendMail;