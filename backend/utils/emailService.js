const nodemailer = require('nodemailer');

// Create transporter
const createTransporter = () => {
  // For development, we'll use a test account or console logging
  // In production, you would use a real email service like Gmail, SendGrid, etc.
  
  if (process.env.NODE_ENV === 'production') {
    // Production email configuration
    return nodemailer.createTransporter({
      service: process.env.EMAIL_SERVICE || 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  } else {
    // Development: Log to console instead of sending real emails
    return {
      sendMail: async (mailOptions) => {
        console.log('\n=== EMAIL WOULD BE SENT ===');
        console.log('To:', mailOptions.to);
        console.log('Subject:', mailOptions.subject);
        console.log('Content:');
        console.log(mailOptions.html || mailOptions.text);
        console.log('=========================\n');
        return { messageId: 'dev-' + Date.now() };
      }
    };
  }
};

const sendWelcomeEmail = async (userEmail, userName) => {
  const transporter = createTransporter();
  
  const mailOptions = {
    from: process.env.EMAIL_FROM || 'noreply@accommodationfinder.com',
    to: userEmail,
    subject: 'Welcome to Accommodation Finder - Your Login Credentials',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Welcome to Accommodation Finder!</h2>
        
        <p>Dear ${userName},</p>
        
        <p>Thank you for registering with Accommodation Finder. Your account has been successfully created!</p>
        
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #374151; margin-top: 0;">Your Account Details:</h3>
          <p><strong>Email:</strong> ${userEmail}</p>
          <p><strong>Account Type:</strong> Successfully created</p>
        </div>
        
        <div style="background-color: #dcfce7; padding: 15px; border-radius: 8px; border-left: 4px solid #16a34a;">
          <p style="margin: 0; color: #166534;">
            <strong>Next Steps:</strong> You can now log in to your account using your email and the password you created during registration.
          </p>
        </div>
        
        <p>Start exploring available properties and find your perfect accommodation!</p>
        
        <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
        
        <p>Best regards,<br>The Accommodation Finder Team</p>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        <p style="font-size: 12px; color: #6b7280;">
          This is an automated message. Please do not reply to this email.
        </p>
      </div>
    `
  };
  
  try {
    const result = await transporter.sendMail(mailOptions);
    console.log('Welcome email sent successfully:', result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('Error sending welcome email:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendWelcomeEmail
};