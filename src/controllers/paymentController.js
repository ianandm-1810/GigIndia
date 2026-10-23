const Razorpay = require("razorpay");
const crypto = require("crypto");
const Payment = require("../models/Payment");
const Gig = require("../models/Gig");
const User = require("../models/User");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// @route POST /api/payments/create-order
const createOrder = async (req, res) => {
  try {
    const { gigId } = req.body;

    const gig = await Gig.findById(gigId);
    if (!gig) {
      return res.status(404).json({ message: "Gig not found" });
    }

    // Sirf gig ka client pay kar sakta hai
    if (gig.client.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    // Razorpay order banana — amount paise mein hota hai (x100)
    const order = await razorpay.orders.create({
      amount: gig.budget * 100,
      currency: "INR",
      receipt: `receipt_${gigId}`
    });

    // Payment record banana
    const platformFee = Math.round(gig.budget * 0.10);
    const studentAmount = gig.budget - platformFee;

    await Payment.create({
      gig: gigId,
      client: req.user._id,
      student: gig.assignedTo,
      totalAmount: gig.budget,
      platformFee,
      studentAmount,
      razorpayOrderId: order.id,
      status: "created"
    });

    // Gig update karo
    gig.razorpayOrderId = order.id;
    gig.paymentStatus = "pending";
    await gig.save();

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route POST /api/payments/verify
const verifyPayment = async (req, res) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

    // Signature verify karo — fake payment rokne ke liye
    const body = razorpayOrderId + "|" + razorpayPaymentId;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpaySignature) {
      return res.status(400).json({ message: "Invalid payment signature" });
    }

    // Payment update karo
    const payment = await Payment.findOne({ razorpayOrderId });
    payment.razorpayPaymentId = razorpayPaymentId;
    payment.status = "escrowed";

    // Auto release date — 5 din baad
    payment.autoReleaseAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    await payment.save();

    // Gig update karo
    await Gig.findByIdAndUpdate(payment.gig, {
      paymentStatus: "escrowed"
    });
    // WhatsApp — client ko batao payment escrowed
const { sendWhatsApp, messages } = require("../utils/whatsapp");
const gigData = await Gig.findById(payment.gig);
const client = await User.findById(payment.client);
if (client.whatsappNumber) {
  await sendWhatsApp(
    client.whatsappNumber,
    messages.paymentEscrowed(gigData.title, payment.totalAmount)
  );
}

    res.json({ message: "Payment verified, money in escrow" });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route POST /api/payments/release/:gigId
const releasePayment = async (req, res) => {
  try {
    const gig = await Gig.findById(req.params.gigId);

    if (!gig) {
      return res.status(404).json({ message: "Gig not found" });
    }

    // Sirf client release kar sakta hai
    if (gig.client.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const payment = await Payment.findOne({ gig: req.params.gigId });
    payment.status = "released";
    await payment.save();

    // Gig complete karo
    gig.status = "completed";
    gig.paymentStatus = "released";
    await gig.save();

    res.json({
      message: "Payment released to student",
      studentAmount: payment.studentAmount,
      platformFee: payment.platformFee
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { createOrder, verifyPayment, releasePayment };