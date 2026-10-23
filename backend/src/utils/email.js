const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const escapeHtml = (value = "") => String(value).replace(/[&<>\"']/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "\"": "&quot;",
  "'": "&#39;"
}[character]));

const sendEmail = async (to, subject, html, options = {}) => {
  try {
    await transporter.sendMail({
      from: `\"GIGI India\" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
      ...options
    });
    console.log(`Email sent to ${to}`);
  } catch (error) {
    console.error(`Email error: ${error.message}`);
    throw error;
  }
};

const emailTemplates = {
  passwordReset: (resetUrl) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #7954f4;">GIGI India Password Reset</h2>
      <p>Tumne password reset request ki hai.</p>
      <p>Neeche wale button pe click karo:</p>
      <a href="${escapeHtml(resetUrl)}"
         style="background: #7954f4; color: white; padding: 12px 24px;
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
  `,
  proposalAccepted: (gigTitle, chatUrl) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #17131b;">
      <h2>Good news from GIGI India</h2>
      <p>Your proposal for <strong>${escapeHtml(gigTitle)}</strong> was accepted.</p>
      <p>Your private project chat is ready. Only you and the client assigned to this gig can access it.</p>
      <p><a href="${escapeHtml(chatUrl)}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#7954f4;color:#fff;text-decoration:none;font-weight:bold;">Open project chat</a></p>
      <p>If you are not signed in, log in with your GIGI India account first, then open this link again.</p>
    </div>
  `
};

const sendSupportEmail = async ({ name, email, role, topic, message }) => {
  const recipient = process.env.SUPPORT_EMAIL || process.env.EMAIL_USER;
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS || !recipient) {
    throw new Error("Email support is not configured");
  }

  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safeRole = escapeHtml(role);
  const safeTopic = escapeHtml(topic);
  const safeMessage = escapeHtml(message).replace(/\r?\n/g, "<br>");

  await transporter.sendMail({
    from: `\"GIGI India Support\" <${process.env.EMAIL_USER}>`,
    to: recipient,
    replyTo: email,
    subject: `[GIGI India support] ${topic}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#17131b"><h2>New support request</h2><p><b>Name:</b> ${safeName}</p><p><b>Email:</b> ${safeEmail}</p><p><b>Account type:</b> ${safeRole}</p><p><b>Topic:</b> ${safeTopic}</p><p><b>Message:</b></p><p>${safeMessage}</p></div>`
  });
};

module.exports = { sendEmail, sendSupportEmail, emailTemplates };
