const twilio = require("twilio");

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const sendWhatsApp = async (to, message) => {
  try {
    // WhatsApp free-form messages require an open customer-service window; proactive production messages need an approved template.
    await client.messages.create({
      from: process.env.TWILIO_WHATSAPP_NUMBER,
      to: `whatsapp:+91${to}`,
      body: message
    });
    console.log(`WhatsApp sent to ${to}`);
  } catch (error) {
    console.error(`WhatsApp error: ${error.message}`);
  }
};

// Ready made messages
const messages = {
  proposalReceived: (gigTitle) =>
    `🎉 GIG INDIA: New proposal received on your gig "${gigTitle}". Log in to review it.`,

  proposalAccepted: (gigTitle) =>
    `✅ GIG INDIA: Your proposal was accepted for "${gigTitle}". Open GIG INDIA to start working.`,

  paymentReceived: (amount) =>
    `💰 GIG INDIA: ₹${amount} has been released to your account. Great work!`,

  gigCompleted: (gigTitle) =>
    `🏆 GIG INDIA: Gig "${gigTitle}" marked complete. Leave a review!`,

  paymentEscrowed: (gigTitle, amount) =>
    `🔒 GIG INDIA: ₹${amount} is now in escrow for "${gigTitle}". Work can begin!`
};

module.exports = { sendWhatsApp, messages };
