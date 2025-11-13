// Profile email (influencer)
export function userProfileEmailHTML({ userName, status /*, reason */ }) {

  let message;
  let color = "#2E86C1"; // default blue

  if (status === "Approved") {
    message =
      "You can now participate in campaigns and explore new opportunities on InfluSage.";
    color = "#28a745"; // green
  } else if (status === "Blocked") {
    message = `
      Your account has been blocked due to violation of our policies.
      <!-- ${/*reason ? `<br/><br/><strong>Reason:</strong> ${reason}` : ""*/ ''}
      <br/><br/>Please contact support if you believe this was a mistake.
    `;
    color = "#c0392b"; // dark red
  } else if (status === "Rejected") {
    message =
      "Your profile has been rejected as it does not comply with our terms and conditions.";
    color = "#e74c3c"; // red
  } else {
    message = "Your profile status has been updated.";
  }

  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #333;">
      <h2 style="color: ${color}">Profile ${status}</h2>
      <p>Hi ${userName},</p>

      <p>Your profile has been <strong>${status}</strong>.</p>
      <p>${message}</p>
      <p>Thank you,<br/>The InfluSage Team</p>
      
    </div>
  `;
}

// Profile email (influencer)
// export function userProfileEmailHTML({ userName, status }) {
//   return `
//     <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #333;">
//       <h2 style="color: #2E86C1;">Profile ${status}</h2>
//       <p>Hi ${userName},</p>
//       <p>Your profile has been <strong>${status}</strong>.</p>
//       <p>${status === "Approved" ? 
//          "You can now participate in campaigns and explore new opportunities on InfluSage."
//           : "Your profile does not follow our terms and conditions."}</p>
//       <p>Thank you!</p>
//     </div>
//   `;
// }

// Campaign email (campaign owner)
export function campaignEmailHTML({ userName,campaignName,status }) {
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #333;">
      <h2 style="color: #2E86C1;">Campaign ${status}</h2>
      <p>Hello ${userName},</p>
      <p>${status === "Approved" 
          ? `Your campaign <strong>${campaignName}</strong> has been <strong>${status}</strong>. It is now active and visible to influencers on InfluSage.`
          : `Your campaign <strong>${campaignName}</strong> has been <strong>${status}</strong> as it does not align with our platform guidelines.`}</p>
      <p>Thank you!</p>
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