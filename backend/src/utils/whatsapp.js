const twilio = require("twilio");

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const sendWhatsApp = async (to, message) => {
  try {
    await client.messages.create({
  from: process.env.TWILIO_WHATSAPP_NUMBER,
  to: `whatsapp:+91${to}`,
  contentSid: "HXfe5ab5f00277942d4d4200328b4d403c"
});
    console.log(`WhatsApp sent to ${to}`);
  } catch (error) {
    console.error(`WhatsApp error: ${error.message}`);
  }
};

// Ready made messages
const messages = {
  proposalReceived: (gigTitle) =>
    `🎉 GigIndia: New proposal received on your gig "${gigTitle}". Login to review it.`,

  proposalAccepted: (gigTitle) =>
    `✅ GigIndia: Your proposal was accepted for "${gigTitle}". Start working now!`,

  paymentReceived: (amount) =>
    `💰 GigIndia: ₹${amount} has been released to your account. Great work!`,

  gigCompleted: (gigTitle) =>
    `🏆 GigIndia: Gig "${gigTitle}" marked complete. Leave a review!`,

  paymentEscrowed: (gigTitle, amount) =>
    `🔒 GigIndia: ₹${amount} is now in escrow for "${gigTitle}". Work can begin!`
};

module.exports = { sendWhatsApp, messages };