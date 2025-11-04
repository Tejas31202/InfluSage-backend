// Profile email (influencer)
export function userProfileEmailHTML({ userName, status }) {
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #333;">
      <h2 style="color: #2E86C1;">Profile ${status}</h2>
      <p>Hi ${userName},</p>
      <p>Your profile has been <strong>${status}</strong>.</p>
      <p>${status === "Approved" ? 
         "You can now participate in campaigns and explore new opportunities on InfluSage."
          : "Your profile does not follow our terms and conditions."}</p>
      <p>Thank you!</p>
    </div>
  `;
}

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

export function htmlContent({otp}){
  `<h3>InfluSage Verification Code</h3>
      <p>Your OTP is: <strong style="font-size:24px;">${otp}</strong></p>
      <p>This code will expire in 10 minutes.</p>`;
}