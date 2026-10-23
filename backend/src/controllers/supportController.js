const { validationResult } = require("express-validator");
const { sendSupportEmail } = require("../utils/email");

const createSupportRequest = async (req, res) => {
  const validationErrors = validationResult(req);
  if (!validationErrors.isEmpty()) {
    return res.status(400).json({ message: "Please check the form and try again", errors: validationErrors.array() });
  }

  try {
    await sendSupportEmail(req.body);
    return res.status(202).json({ message: "Your message has been sent to GIG INDIA Support" });
  } catch (error) {
    console.error(`Support request email failed: ${error.message}`);
    return res.status(503).json({ message: "Email support is temporarily unavailable. Please try again later." });
  }
};

module.exports = { createSupportRequest };
