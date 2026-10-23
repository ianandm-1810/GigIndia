const Razorpay = require("razorpay");
const Payment = require("../models/Payment");
const Gig = require("../models/Gig");
const User = require("../models/User");
const { sendWhatsApp, messages } = require("./whatsapp");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

const setStatusError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const refreshStudentEarnings = async (studentId) => {
  const [result] = await Payment.aggregate([
    { $match: { student: studentId, status: "released" } },
    { $group: { _id: "$student", total: { $sum: "$studentAmount" } } }
  ]);
  await User.findByIdAndUpdate(studentId, { $set: { totalEarnings: result?.total || 0 } });
};

const finalizeRelease = async (payment) => {
  const releasedAt = new Date();
  const released = await Payment.findOneAndUpdate(
    { _id: payment._id, status: "releasing" },
    {
      $set: { status: "released", releasedAt, autoReleaseAt: null, statusBeforeProcessing: "", operationStartedAt: null }
    },
    { new: true }
  );
  if (!released) return null;

  await Promise.all([
    Gig.findByIdAndUpdate(payment.gig, {
      status: "completed",
      paymentStatus: "released",
      completedAt: releasedAt
    }),
    refreshStudentEarnings(payment.student)
  ]);

  const student = await User.findById(payment.student);
  if (student?.whatsappNumber) {
    await sendWhatsApp(student.whatsappNumber, messages.paymentReceived(payment.studentAmount));
  }
  return released;
};

const releaseHeldPayment = async (paymentId, { allowDisputed = false } = {}) => {
  const payment = await Payment.findById(paymentId);
  if (!payment) throw setStatusError("Payment not found", 404);

  if (payment.status === "released") {
    await Gig.findByIdAndUpdate(payment.gig, {
      status: "completed",
      paymentStatus: "released",
      completedAt: payment.releasedAt || new Date()
    });
    await refreshStudentEarnings(payment.student);
    return { payment, alreadyReleased: true };
  }

  const eligibleStatuses = allowDisputed ? ["escrowed", "disputed"] : ["escrowed"];
  if (!eligibleStatuses.includes(payment.status)) {
    throw setStatusError("Payment is not eligible for release", 409);
  }
  if (!payment.razorpayTransferId) {
    throw setStatusError("No Razorpay Route transfer is linked to this payment", 409);
  }

  const priorStatus = payment.status;
  const claimed = await Payment.findOneAndUpdate(
    { _id: payment._id, status: priorStatus },
    {
      $set: {
        status: "releasing",
        statusBeforeProcessing: priorStatus,
        operationStartedAt: new Date()
      }
    },
    { new: true }
  );
  if (!claimed) {
    const latest = await Payment.findById(payment._id);
    if (latest?.status === "released") return { payment: latest, alreadyReleased: true };
    throw setStatusError("Payment release is already being processed", 409);
  }

  try {
    // Route releases the held settlement. The linked account's settlement schedule still applies.
    await razorpay.transfers.edit(payment.razorpayTransferId, { on_hold: false });
    const released = await finalizeRelease(payment);
    if (!released) throw new Error("Razorpay released the transfer but the payment record could not be updated");
    return { payment: released, alreadyReleased: false };
  } catch (error) {
    await Payment.findOneAndUpdate(
      { _id: payment._id, status: "releasing" },
      { $set: { status: priorStatus, statusBeforeProcessing: "", operationStartedAt: null } }
    );
    throw error;
  }
};

const refundPayment = async (paymentId, { allowedStatuses = ["disputed"], reason = "GIGI India admin dispute resolution" } = {}) => {
  const payment = await Payment.findById(paymentId);
  if (!payment) throw setStatusError("Payment not found", 404);
  if (payment.status === "refunded") return { payment, alreadyRefunded: true };
  if (!allowedStatuses.includes(payment.status)) throw setStatusError("Payment is not eligible for an admin refund", 409);
  if (!payment.razorpayPaymentId) throw setStatusError("Razorpay payment ID is missing", 409);

  const priorStatus = payment.status;
  const claimed = await Payment.findOneAndUpdate(
    { _id: payment._id, status: priorStatus },
    { $set: { status: "refunding", statusBeforeProcessing: priorStatus, operationStartedAt: new Date() } },
    { new: true }
  );
  if (!claimed) {
    const latest = await Payment.findById(payment._id);
    if (latest?.status === "refunded") return { payment: latest, alreadyRefunded: true };
    throw setStatusError("Payment refund is already being processed", 409);
  }

  try {
    // The gig ID in refund notes lets a retry recover a refund created just before a server restart.
    let refunds = { items: [] };
    try {
      refunds = await razorpay.payments.fetchMultipleRefund(payment.razorpayPaymentId, { count: 100 });
    } catch (error) {
      // No previous refund list is available; attempt the refund request below.
    }
    let refund = refunds.items?.find((item) =>
      item.amount === Math.round(payment.totalAmount * 100) &&
      item.notes?.gigId === String(payment.gig)
    );
    if (!refund) {
      refund = await razorpay.payments.refund(payment.razorpayPaymentId, {
        amount: Math.round(payment.totalAmount * 100),
        reverse_all: true,
        notes: { gigId: String(payment.gig), reason: reason.slice(0, 200) }
      });
    }

    const refundedAt = new Date();
    const saved = await Payment.findOneAndUpdate(
      { _id: payment._id, status: "refunding" },
      {
        $set: {
          status: "refunded",
          refundedAt,
          razorpayRefundId: refund.id,
          autoReleaseAt: null,
          statusBeforeProcessing: "",
          operationStartedAt: null
        }
      },
      { new: true }
    );
    if (!saved) throw new Error("Razorpay refunded the payment but the payment record could not be updated");
    await Gig.findByIdAndUpdate(payment.gig, { status: "cancelled", paymentStatus: "refunded" });
    return { payment: saved, alreadyRefunded: false };
  } catch (error) {
    await Payment.findOneAndUpdate(
      { _id: payment._id, status: "refunding" },
      { $set: { status: priorStatus, statusBeforeProcessing: "", operationStartedAt: null } }
    );
    throw error;
  }
};

const recoverStalePaymentOperations = async () => {
  const cutoff = new Date(Date.now() - 5 * 60 * 1000);
  const stale = await Payment.find({
    status: { $in: ["releasing", "refunding"] },
    operationStartedAt: { $lte: cutoff }
  }).limit(50);

  for (const payment of stale) {
    try {
      if (payment.status === "releasing") {
        const transfer = payment.razorpayTransferId
          ? await razorpay.transfers.fetch(payment.razorpayTransferId)
          : null;
        if (transfer && transfer.on_hold === false) {
          const released = await finalizeRelease(payment);
          if (released) continue;
        }
      } else if (payment.status === "refunding" && payment.razorpayPaymentId) {
        const refunds = await razorpay.payments.fetchMultipleRefund(payment.razorpayPaymentId, { count: 100 });
        const refund = refunds.items?.find((item) =>
          item.amount === Math.round(payment.totalAmount * 100) &&
          item.notes?.gigId === String(payment.gig)
        );
        if (refund) {
          const refundedAt = new Date();
          const saved = await Payment.findOneAndUpdate(
            { _id: payment._id, status: "refunding" },
            {
              $set: {
                status: "refunded",
                refundedAt,
                razorpayRefundId: refund.id,
                autoReleaseAt: null,
                statusBeforeProcessing: "",
                operationStartedAt: null
              }
            },
            { new: true }
          );
          if (saved) await Gig.findByIdAndUpdate(payment.gig, { status: "cancelled", paymentStatus: "refunded" });
          continue;
        }
      }

      const fallbackStatus = payment.statusBeforeProcessing || "disputed";
      await Payment.findOneAndUpdate(
        { _id: payment._id, status: payment.status, operationStartedAt: payment.operationStartedAt },
        { $set: { status: fallbackStatus, statusBeforeProcessing: "", operationStartedAt: null } }
      );
    } catch (error) {
      console.error(`Stale payment operation recovery failed for ${payment._id}: ${error.message}`);
    }
  }
};

const processDueAutoReleases = async () => {
  await recoverStalePaymentOperations();
  const duePayments = await Payment.find({
    status: "escrowed",
    razorpayTransferId: { $exists: true, $ne: "" },
    autoReleaseAt: { $lte: new Date() }
  }).limit(50);

  for (const payment of duePayments) {
    try {
      const gig = await Gig.findById(payment.gig).select("status submittedAt");
      if (gig?.status !== "submitted" || !gig.submittedAt) continue;
      await releaseHeldPayment(payment._id);
    } catch (error) {
      console.error(`Auto-release failed for payment ${payment._id}: ${error.message}`);
    }
  }
};

module.exports = { releaseHeldPayment, refundPayment, processDueAutoReleases };
