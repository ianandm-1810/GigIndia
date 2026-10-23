const Razorpay = require("razorpay");
const crypto = require("crypto");
const mongoose = require("mongoose");
const Payment = require("../models/Payment");
const Gig = require("../models/Gig");
const User = require("../models/User");
const { sendWhatsApp, messages } = require("../utils/whatsapp");
const { releaseHeldPayment } = require("../utils/paymentService");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

const fail = (res, error) => res.status(error.statusCode || 500).json({
  message: error.statusCode ? error.message : "Payment could not be processed. Please retry or contact support."
});

// POST /api/payments/create-order
const createOrder = async (req, res) => {
  try {
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
    if (!gig.assignedTo || gig.status !== "in-progress") {
      return res.status(409).json({ message: "Accept a proposal before creating a payment order" });
    }

    const student = await User.findById(gig.assignedTo).select("razorpayAccountId role");
    if (!student || student.role !== "student") {
      return res.status(409).json({ message: "The assigned student account is unavailable" });
    }
    if (!student.razorpayAccountId) {
      return res.status(409).json({
        code: "RAZORPAY_ROUTE_ACCOUNT_REQUIRED",
        message: "The student must be onboarded as a Razorpay Route linked account before this gig can be paid"
      });
    }

    const existing = await Payment.findOne({ gig: gig._id, status: { $nin: ["released", "refunded"] } });
    if (existing) {
      if (existing.status === "created") {
        return res.json({
          orderId: existing.razorpayOrderId,
          amount: Math.round(existing.totalAmount * 100),
          currency: "INR",
          keyId: process.env.RAZORPAY_KEY_ID
        });
      }
      return res.status(409).json({ message: `This gig already has a payment in ${existing.status} status` });
    }

    const totalAmount = Number(gig.budget);
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
      status: "created"
    });

    gig.razorpayOrderId = order.id;
    gig.paymentStatus = "pending";
    await gig.save();

    return res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID
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

    const paymentRecord = await Payment.findOne({ razorpayOrderId });
    if (!paymentRecord) return res.status(404).json({ message: "Payment order not found" });
    if (paymentRecord.client.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Only the client who created the order can verify it" });
    }

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest("hex");
    const expectedBuffer = Buffer.from(expectedSignature, "hex");
    const suppliedBuffer = Buffer.from(razorpaySignature, "hex");
    if (expectedBuffer.length !== suppliedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, suppliedBuffer)) {
      return res.status(400).json({ message: "Invalid payment signature" });
    }

    if (paymentRecord.status === "escrowed") {
      if (!paymentRecord.razorpayTransferId) {
        return res.status(409).json({
          code: "ROUTE_TRANSFER_MISSING",
          message: "This older payment record has no Razorpay Route transfer ID. Do not pay again; ask an admin to review the existing payment."
        });
      }
      return res.json({ message: "Payment is verified and the student's transfer is held" });
    }
    if (!["created", "paid"].includes(paymentRecord.status)) {
      return res.status(409).json({ message: `Payment cannot be verified in ${paymentRecord.status} status` });
    }

    const gatewayPayment = await razorpay.payments.fetch(razorpayPaymentId);
    if (gatewayPayment.order_id !== razorpayOrderId || gatewayPayment.amount !== Math.round(paymentRecord.totalAmount * 100)) {
      return res.status(400).json({ message: "Razorpay payment does not match this order" });
    }
    if (gatewayPayment.status !== "captured") {
      return res.status(409).json({ message: "Payment is not captured yet. Do not submit work until it is captured." });
    }

    paymentRecord.razorpayPaymentId = razorpayPaymentId;
    paymentRecord.status = "paid";
    await paymentRecord.save();

    const student = await User.findById(paymentRecord.student).select("razorpayAccountId");
    if (!student?.razorpayAccountId) {
      return res.status(409).json({
        code: "RAZORPAY_ROUTE_ACCOUNT_REQUIRED",
        message: "Razorpay captured this payment, but the student has no Route linked account. Do not pay again; configure the student's linked account and retry verification."
      });
    }

    // Re-fetch first so a retry after a server restart does not create a duplicate transfer.
    let transferCollection;
    try {
      transferCollection = await razorpay.payments.fetchTransfer(razorpayPaymentId);
    } catch (error) {
      console.error(`Could not fetch Route transfers for payment ${paymentRecord._id}: ${error.message}`);
      return res.status(502).json({
        code: "ROUTE_TRANSFER_LOOKUP_FAILED",
        message: "Razorpay captured this payment, but its Route transfers could not be checked. Do not pay again; retry verification."
      });
    }
    const transfers = transferCollection?.items || [];
    let transfer = transfers.find((item) => item.recipient === student.razorpayAccountId);

    try {
      if (transfers.length > 0 && !transfer) {
        throw new Error("A Route transfer exists for a different linked account; admin review is required");
      }
      if (!transfer) {
        const created = await razorpay.payments.transfer(razorpayPaymentId, {
          transfers: [{
            account: student.razorpayAccountId,
            amount: Math.round(paymentRecord.studentAmount * 100),
            currency: "INR",
            on_hold: true,
            notes: { gigId: String(paymentRecord.gig) }
          }]
        });
        transfer = created?.items?.find((item) => item.recipient === student.razorpayAccountId) || created?.items?.[0];
      } else if (transfer.on_hold !== true) {
        throw new Error("An existing Route transfer is not on hold; it cannot safely be treated as escrowed");
      }

      if (!transfer?.id || transfer.on_hold !== true) {
        throw new Error("Razorpay did not confirm that the student's transfer is held");
      }

      paymentRecord.razorpayTransferId = transfer.id;
      paymentRecord.status = "escrowed";
      paymentRecord.autoReleaseAt = null;
      await paymentRecord.save();
      await Gig.findByIdAndUpdate(paymentRecord.gig, { paymentStatus: "escrowed" });

      const gig = await Gig.findById(paymentRecord.gig);
      const client = await User.findById(paymentRecord.client);
      if (client?.whatsappNumber && gig) {
        await sendWhatsApp(client.whatsappNumber, messages.paymentEscrowed(gig.title, paymentRecord.totalAmount));
      }

      return res.json({ message: "Payment verified; the student's Razorpay Route transfer is held" });
    } catch (routeError) {
      console.error(`Razorpay Route transfer setup failed for payment ${paymentRecord._id}: ${routeError.message}`);
      return res.status(502).json({
        code: "ROUTE_TRANSFER_SETUP_FAILED",
        message: "Razorpay captured this payment, but the held student transfer was not confirmed. Do not pay again; retry verification or ask an admin to resolve it."
      });
    }
  } catch (error) {
    return fail(res, error);
  }
};

// POST /api/payments/release/:gigId — client approves the submitted work.
const releasePayment = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.gigId)) {
      return res.status(400).json({ message: "Invalid gig ID" });
    }
    const gig = await Gig.findById(req.params.gigId);
    if (!gig) return res.status(404).json({ message: "Gig not found" });
    if (gig.client.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Only this gig's client can approve the work" });
    }
    if (gig.status !== "submitted" || gig.paymentStatus !== "escrowed") {
      return res.status(409).json({ message: "The gig must have submitted work and a held payment before approval" });
    }

    const payment = await Payment.findOne({ gig: gig._id, status: "escrowed" });
    if (!payment) return res.status(404).json({ message: "Held payment not found" });
    const result = await releaseHeldPayment(payment._id);
    return res.json({
      message: result.alreadyReleased ? "Payment was already released" : "Razorpay Route released the held transfer",
      studentAmount: result.payment.studentAmount,
      platformFee: result.payment.platformFee
    });
  } catch (error) {
    return fail(res, error);
  }
};

// POST /api/payments/dispute/:gigId — pause automatic release pending admin review.
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
    if (gig.status !== "submitted" || gig.paymentStatus !== "escrowed") {
      return res.status(409).json({ message: "Only submitted work with a held payment can be disputed" });
    }

    const payment = await Payment.findOneAndUpdate(
      { gig: gig._id, status: "escrowed" },
      { $set: { status: "disputed", autoReleaseAt: null } },
      { new: true }
    );
    if (!payment) return res.status(409).json({ message: "Payment is no longer available to dispute" });

    gig.status = "disputed";
    gig.disputedAt = new Date();
    gig.disputeReason = reason.trim();
    await gig.save();
    return res.status(201).json({ message: "Dispute opened; automatic release has been paused", gigId: gig._id });
  } catch (error) {
    return fail(res, error);
  }
};

module.exports = { createOrder, verifyPayment, releasePayment, disputePayment };
