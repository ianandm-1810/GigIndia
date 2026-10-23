const Razorpay = require("razorpay");

const getRazorpayConfig = () => {
  const mode = process.env.PAYMENT_MODE || "test";
  if (!["test", "live"].includes(mode)) {
    const error = new Error("PAYMENT_MODE must be set to test or live");
    error.statusCode = 503;
    throw error;
  }

  const keyId = process.env.RAZORPAY_KEY_ID || "";
  const keySecret = process.env.RAZORPAY_KEY_SECRET || "";
  const expectedPrefix = mode === "test" ? "rzp_test_" : "rzp_live_";
  if (!keyId.startsWith(expectedPrefix) || !keySecret) {
    const error = new Error(`Configure a Razorpay ${mode} Key ID and secret before using payments`);
    error.statusCode = 503;
    throw error;
  }

  return { mode, keyId, keySecret };
};

const createRazorpayClient = () => {
  const config = getRazorpayConfig();
  return {
    ...config,
    client: new Razorpay({ key_id: config.keyId, key_secret: config.keySecret })
  };
};

const assertPaymentMode = (payment) => {
  const { mode } = getRazorpayConfig();
  const recordedMode = payment.mode || "live";
  if (recordedMode !== mode) {
    const error = new Error(`This ${recordedMode} payment cannot be processed while Razorpay is configured for ${mode} mode`);
    error.statusCode = 409;
    throw error;
  }
  return mode;
};

module.exports = { getRazorpayConfig, createRazorpayClient, assertPaymentMode };
