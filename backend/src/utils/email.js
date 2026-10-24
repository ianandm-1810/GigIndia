const BREVO_EMAIL_ENDPOINT = "https://api.brevo.com/v3/smtp/email";

const escapeHtml = (value = "") => String(value).replace(/[&<>\"']/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "\"": "&quot;",
  "'": "&#39;"
}[character]));

const sendWithBrevo = async ({ to, subject, html, replyTo, senderName = "GIG INDIA" }) => {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.EMAIL_USER;

  if (!apiKey || !senderEmail) {
    throw new Error("Email service is not configured. Set BREVO_API_KEY and a verified EMAIL_USER sender.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(BREVO_EMAIL_ENDPOINT, {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": apiKey,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        sender: { name: senderName, email: senderEmail },
        to: [{ email: to }],
        subject,
        htmlContent: html,
        ...(replyTo ? { replyTo: { email: replyTo } } : {})
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      // Do not log provider response bodies: they may include personal information.
      throw new Error(`Email provider rejected the request (HTTP ${response.status}).`);
    }

    console.log("Email accepted by the transactional email provider");
  } catch (error) {
    const message = error.name === "AbortError"
      ? "Email provider request timed out."
      : error.message;
    console.error(`Email delivery failed: ${message}`);
    throw new Error(message);
  } finally {
    clearTimeout(timeout);
  }
};

const sendEmail = async (to, subject, html) => sendWithBrevo({ to, subject, html });

const emailTemplates = {
  passwordReset: (resetUrl) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #7954f4;">GIG INDIA Password Reset</h2>
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
      <h2>Good news from GIG INDIA</h2>
      <p>Your proposal for <strong>${escapeHtml(gigTitle)}</strong> was accepted.</p>
      <p>Your private project chat is ready. Only you and the client assigned to this gig can access it.</p>
      <p><a href="${escapeHtml(chatUrl)}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#7954f4;color:#fff;text-decoration:none;font-weight:bold;">Open project chat</a></p>
      <p>If you are not signed in, log in with your GIG INDIA account first, then open this link again.</p>
    </div>
  `
};

const sendSupportEmail = async ({ name, email, role, topic, message }) => {
  const recipient = process.env.SUPPORT_EMAIL || process.env.EMAIL_USER;
  if (!recipient) {
    throw new Error("Support email recipient is not configured");
  }

  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safeRole = escapeHtml(role);
  const safeTopic = escapeHtml(topic);
  const safeMessage = escapeHtml(message).replace(/\r?\n/g, "<br>");

  await sendWithBrevo({
    to: recipient,
    replyTo: email,
    senderName: "GIG INDIA Support",
    subject: `[GIG INDIA support] ${topic}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#17131b"><h2>New support request</h2><p><b>Name:</b> ${safeName}</p><p><b>Email:</b> ${safeEmail}</p><p><b>Account type:</b> ${safeRole}</p><p><b>Topic:</b> ${safeTopic}</p><p><b>Message:</b></p><p>${safeMessage}</p></div>`
  });
};

module.exports = { sendEmail, sendSupportEmail, emailTemplates };
