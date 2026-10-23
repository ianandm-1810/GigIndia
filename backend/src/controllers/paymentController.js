const crypto = require("crypto");
const mongoose = require("mongoose");
const Payment = require("../models/Payment");
const Gig = require("../models/Gig");
const User = require("../models/User");
const { sendWhatsApp, messages } = require("../utils/whatsapp");
const { getRazorpayConfig, createRazorpayClient } = require("../utils/razorpayConfig");

const fail = (res, error) => res.status(error.statusCode || 500).json({
  message: error.statusCode ? error.message : "Payment could not be processed. Please retry or contact support."
});

// POST /api/payments/create-order
const createOrder = async (req, res) => {
  try {
    const { mode, keyId, client: razorpay } = createRazorpayClient();
    const { gigId } = req.body;
    if (!mongoose.isValidObjectId(gigId)) {
      return res.status(400).json({ message: "A valid gigId is required" });
    }
    if (req.user.role !== "client") {
      return res.status(403).json({ message: "Only clients can pay for a gig" });
    }

    const gig = await Gig.findById(gigId);
    if (!gig) return res.status(404).json({ message: "Gig not found" });
    if (gig.client.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Only this gig's client can pay" });
    }
    if (!gig.assignedTo || gig.status !== "submitted" || gig.paymentStatus !== "pending") {
      return res.status(409).json({ message: "The assigned student must submit the work before the client can pay" });
    }

    const student = await User.findById(gig.assignedTo).select("role");
    if (!student || student.role !== "student") {
      return res.status(409).json({ message: "The assigned student account is unavailable" });
    }

    const existing = await Payment.findOne({ gig: gig._id, status: { $nin: ["released", "refunded"] } });
    if (existing) {
      if (existing.status === "created") {
        if ((existing.mode || "live") !== mode) return res.status(409).json({ message: "This order belongs to a different Razorpay mode. Do not retry it in the current environment." });
        return res.json({
          orderId: existing.razorpayOrderId,
          amount: Math.round(existing.totalAmount * 100),
          currency: "INR",
          keyId,
          mode
        });
      }
      return res.status(409).json({ message: `This gig already has a payment in ${existing.status} status` });
    }

    const totalAmount = Number(gig.agreedAmount || gig.budget);
    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      return res.status(400).json({ message: "Gig budget is invalid" });
    }

    const order = await razorpay.orders.create({
      amount: Math.round(totalAmount * 100),
      currency: "INR",
      receipt: `gig_${gig._id}`,
      partial_payment: false,
      notes: { gigId: String(gig._id) }
    });

    const platformFee = Math.round(totalAmount * 0.10);
    const studentAmount = totalAmount - platformFee;
    await Payment.create({
      gig: gig._id,
      client: req.user._id,
      student: gig.assignedTo,
      totalAmount,
      platformFee,
      studentAmount,
      razorpayOrderId: order.id,
      status: "created",
      mode
    });

    gig.razorpayOrderId = order.id;
    await gig.save();

    return res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId,
      mode
    });
  } catch (error) {
    return fail(res, error);
  }
};

// POST /api/payments/verify
const verifyPayment = async (req, res) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
    if (![razorpayOrderId, razorpayPaymentId, razorpaySignature].every((value) => typeof value === "string" && value)) {
      return res.status(400).json({ message: "Razorpay order, payment, and signature are required" });
    }

    const { mode, keySecret } = getRazorpayConfig();
    const paymentRecord = await Payment.findOne({ razorpayOrderId });
    if (!paymentRecord) return res.status(404).json({ message: "Payment order not found" });
    if (paymentRecord.client.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Only the client who created the order can verify it" });
    }
    if (paymentRecord.razorpayPaymentId && paymentRecord.razorpayPaymentId !== razorpayPaymentId) {
      return res.status(409).json({ message: "This order already has a different captured payment recorded. Contact GIG INDIA support before retrying." });
    }
    if ((paymentRecord.mode || "live") !== mode) {
      return res.status(409).json({ message: "This payment belongs to a different Razorpay mode. Use the matching environment to continue." });
    }

    const expectedSignature = crypto
      .createHmac("sha256", keySecret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest("hex");
    const expectedBuffer = Buffer.from(expectedSignature, "hex");
    const suppliedBuffer = Buffer.from(razorpaySignature, "hex");
    if (expectedBuffer.length !== suppliedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, suppliedBuffer)) {
      return res.status(400).json({ message: "Invalid payment signature" });
    }

    if (paymentRecord.status === "escrowed") {
      return res.json({ mode, message: "Payment is already recorded. The client must close the project before an admin can approve payout." });
    }
    if (!["created", "paid"].includes(paymentRecord.status)) {
      return res.status(409).json({ message: `Payment cannot be verified in ${paymentRecord.status} status` });
    }

    const { client: razorpay } = createRazorpayClient();
    const gatewayPayment = await razorpay.payments.fetch(razorpayPaymentId);
    if (gatewayPayment.order_id !== razorpayOrderId || gatewayPayment.amount !== Math.round(paymentRecord.totalAmount * 100)) {
      return res.status(400).json({ message: "Razorpay payment does not match this order" });
    }
    if (gatewayPayment.status !== "captured") {
      return res.status(409).json({ message: "Payment is not captured yet. Do not submit work until it is captured." });
    }

    paymentRecord.razorpayPaymentId = razorpayPaymentId;
    paymentRecord.paidAt = new Date();
    paymentRecord.status = "paid";
    await paymentRecord.save();

    paymentRecord.autoReleaseAt = null;
    await paymentRecord.save();
    await Gig.findByIdAndUpdate(paymentRecord.gig, { paymentStatus: "paid" });

    const gig = await Gig.findById(paymentRecord.gig);
    const client = await User.findById(paymentRecord.client);
    if (client?.whatsappNumber && gig) {
      await sendWhatsApp(client.whatsappNumber, messages.paymentEscrowed(gig.title, paymentRecord.totalAmount));
    }

    return res.json({
      mode,
      message: mode === "test"
        ? "Test payment recorded. No real money moved; payout will be simulated after the client closes the project and an admin approves it."
        : "Payment received in the GIG INDIA Razorpay account. The client can now close the project; an admin must approve the student payout."
    });
  } catch (error) {
    return fail(res, error);
  }
};

// POST /api/payments/close/:gigId — client confirms the reviewed work and requests admin payout approval.
const closeProject = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.gigId)) {
      return res.status(400).json({ message: "Invalid gig ID" });
    }
    const gig = await Gig.findById(req.params.gigId);
    if (!gig) return res.status(404).json({ message: "Gig not found" });
    if (gig.client.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Only this gig's client can close the project" });
    }
    if (gig.status !== "submitted" || !["paid", "escrowed"].includes(gig.paymentStatus)) {
      return res.status(409).json({ message: "The student must submit work and the client payment must be recorded before closing the project" });
    }

    const now = new Date();
    const payment = await Payment.findOneAndUpdate(
      { gig: gig._id, status: { $in: ["paid", "escrowed"] }, clientClosedAt: null },
      { $set: { clientClosedAt: now, autoReleaseAt: null } },
      { new: true }
    );
    if (!payment) return res.status(409).json({ message: "The payment is already closed or awaiting admin review" });

    const closedGig = await Gig.findOneAndUpdate(
      { _id: gig._id, client: req.user._id, status: "submitted", paymentStatus: { $in: ["paid", "escrowed"] } },
      { $set: { status: "pending-admin-approval", clientClosedAt: now, closedAt: now } },
      { new: true }
    );
    if (!closedGig) {
      await Payment.updateOne({ _id: payment._id, clientClosedAt: now }, { $set: { clientClosedAt: null } });
      return res.status(409).json({ message: "Project status changed. Refresh the page and try again." });
    }

    return res.json({
      mode: payment.mode || "live",
      message: "Project closed. GIG INDIA admin approval is now required before the student's 90% payout is released.",
      studentAmount: payment.studentAmount,
      platformFee: payment.platformFee,
      gig: closedGig
    });
  } catch (error) {
    return fail(res, error);
  }
};

// POST /api/payments/dispute/:gigId — pause payout pending admin review.
const disputePayment = async (req, res) => {
  try {
    const { reason } = req.body;
    if (!mongoose.isValidObjectId(req.params.gigId)) {
      return res.status(400).json({ message: "Invalid gig ID" });
    }
    if (typeof reason !== "string" || !reason.trim() || reason.trim().length > 2000) {
      return res.status(400).json({ message: "A dispute reason of 1–2000 characters is required" });
    }

    const gig = await Gig.findById(req.params.gigId);
    if (!gig) return res.status(404).json({ message: "Gig not found" });
    const isParticipant = [gig.client, gig.assignedTo].some((id) => id && id.toString() === req.user._id.toString());
    if (!isParticipant) return res.status(403).json({ message: "Only the client or assigned student can dispute this gig" });
    if (gig.status !== "submitted" || !["paid", "escrowed"].includes(gig.paymentStatus)) {
      return res.status(409).json({ message: "Only submitted work with a recorded payment can be disputed" });
    }

    const payment = await Payment.findOneAndUpdate(
      { gig: gig._id, status: { $in: ["paid", "escrowed"] } },
      { $set: { status: "disputed", autoReleaseAt: null } },
      { new: true }
    );
    if (!payment) return res.status(409).json({ message: "Payment is no longer available to dispute" });

    gig.status = "disputed";
    gig.disputedAt = new Date();
    gig.disputeReason = reason.trim();
    await gig.save();
    return res.status(201).json({ message: "Dispute opened; payout is paused for admin review", gigId: gig._id });
  } catch (error) {
    return fail(res, error);
  }
};

// GET /api/payments/mine — transaction history for the signed-in participant.
const getMyPayments = async (req, res) => {
  try {
    const filter = req.user.role === "student"
      ? { student: req.user._id }
      : req.user.role === "client"
        ? { client: req.user._id }
        : null;
    if (!filter) return res.status(403).json({ message: "Payment history is available to students and clients" });

    const payments = await Payment.find(filter)
      .select("gig totalAmount platformFee studentAmount status mode razorpayPaymentId createdAt paidAt clientClosedAt releasedAt refundedAt")
      .populate("gig", "title category status")
      .sort({ createdAt: -1 });
    return res.json(payments);
  } catch (error) {
    return fail(res, error);
  }
};

module.exports = { createOrder, verifyPayment, closeProject, disputePayment, getMyPayments };
