

// Profile email (influencer)
export function userProfileEmailHTML({ userName }) {
    const status = "Approved";
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #333;">
      <h2 style="color: #2E86C1;">Profile ${status}</h2>
      <p>Hello ${userName},</p>
      <p>Your profile has been <strong>${status}</strong>.</p>
      <p>You can now participate in campaigns and explore new opportunities on InfluSage.</p>
      <p>The InfluSage Team</p>
    </div>
  `;
}

// Campaign email (campaign owner)
export function campaignEmailHTML({ userName, campaignName }) {
  const status = "Approved";
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #333;">
      <h2 style="color: #2E86C1;">Campaign ${status}</h2>
      <p>Hello ${userName},</p>
      <p>Your campaign <strong>${campaignName}</strong> has been <strong>${status}</strong>. 
      It is now active and visible to influencers on InfluSage.</p>
      <p>The InfluSage Team</p>
    </div>
  `;
}

export function htmlContent({ otp }) {
  return `
      <div style="font-family: Arial, sans-serif;">
        <h2>InfluSage Verification Code</h2>
        <p>Your OTP is: <b>${otp}</b></p>
        <p>This code expires in 1 minutes.</p>
      </div>
  `;
}
 

export const userProfileBlockEmailHTML = ({ userName }) => `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px;border-radius:10px;">
    <h2 style="color:#333;">Hello ${userName},</h2>
    <p style="font-size:16px;color:#555;">
      Your profile has been <strong>Blocked</strong> by our admin team.
    </p>
    <p style="font-size:15px;color:#555;">
      If you believe this was done in error or wish to appeal, please contact our support team.
    </p>
    <br />
    <p style="font-size:14px;color:#777;">The InfluSage Team</p>
  </div>
`;

export const userProfileRejectEmailHTML = ({ userName, reason }) => `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px;border-radius:10px;">
    <h2 style="color:#333;">Hello ${userName},</h2>
    <p style="font-size:16px;color:#555;">
      Your profile has been <strong>Rejected</strong> by our admin team.
    </p>
    <p style="font-size:15px;color:#555;">
      <strong>Reason:</strong> ${reason}
    </p>
    <p style="font-size:15px;color:#555;">
      If you believe this was done in error or wish to appeal, please contact our support team.
    </p>
    <br />
    <p style="font-size:14px;color:#777;">The InfluSage Team</p>
  </div>
`;

export const campaignRejectEmailHTML = ({ userName, campaignName, reason }) => `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px;border-radius:10px;">
    <h2 style="color:#333;">Hello ${userName},</h2>
    <p style="font-size:16px;color:#555;">
      Your campaign <strong>"${campaignName}"</strong> has been <strong>Rejected</strong> by our admin team.
    </p>
    <p style="font-size:15px;color:#555;">
      <strong>Reason:</strong> ${reason}
    </p>
    <p style="font-size:15px;color:#555;">
      Please review the details and update your campaign accordingly.  
      Once corrected, you may resubmit it for approval.
    </p>
    <br />
    <p style="font-size:14px;color:#777;">The InfluSage Team</p>
  </div>
`;