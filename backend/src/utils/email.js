const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const sendEmail = async (to, subject, html) => {
  try {
    await transporter.sendMail({
      from: `"GigIndia" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html
    });
    console.log(`Email sent to ${to}`);
  } catch (error) {
    console.error(`Email error: ${error.message}`);
  }
};

const emailTemplates = {
  passwordReset: (resetUrl) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #f97316;">GigIndia Password Reset</h2>
      <p>Tumne password reset request ki hai.</p>
      <p>Neeche wale button pe click karo:</p>
      <a href="${resetUrl}" 
         style="background: #f97316; color: white; padding: 12px 24px; 
                text-decoration: none; border-radius: 6px; display: inline-block;">
        Reset Password
      </a>
      <p style="color: #666; margin-top: 20px;">
        Yeh link 10 minutes mein expire ho jaayega.
      </p>
      <p style="color: #666;">
        Agar tumne request nahi ki toh ignore karo.
      </p>
    </div>
  `
};

module.exports = { sendEmail, emailTemplates };