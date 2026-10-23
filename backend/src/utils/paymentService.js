const Payment = require("../models/Payment");
const Gig = require("../models/Gig");
const User = require("../models/User");
const { sendWhatsApp, messages } = require("./whatsapp");

const { createRazorpayClient, assertPaymentMode } = require("./razorpayConfig");

const setStatusError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const refreshStudentEarnings = async (studentId) => {
  const [result] = await Payment.aggregate([
    { $match: { student: studentId, status: "released", mode: { $ne: "test" } } },
    { $group: { _id: "$student", total: { $sum: "$studentAmount" } } }
  ]);
  await User.findByIdAndUpdate(studentId, { $set: { totalEarnings: result?.total || 0 } });
};

const finalizeRelease = async (payment) => {
  const releasedAt = new Date();
  const gigBeforeRelease = await Gig.findById(payment.gig).select("closedAt clientClosedAt completedAt");
  const released = await Payment.findOneAndUpdate(
    { _id: payment._id, status: "releasing" },
    {
      $set: { status: "released", releasedAt, autoReleaseAt: null, adminHold: false, adminHoldClearedAt: payment.adminHold ? releasedAt : payment.adminHoldClearedAt, statusBeforeProcessing: "", operationStartedAt: null }
    },
    { new: true }
  );
  if (!released) return null;

  await Promise.all([
    Gig.findByIdAndUpdate(payment.gig, {
      status: "completed",
      paymentStatus: "released",
      completedAt: releasedAt,
      closedAt: payment.clientClosedAt || gigBeforeRelease?.clientClosedAt || gigBeforeRelease?.closedAt || releasedAt
    }),
    refreshStudentEarnings(payment.student)
  ]);

  const student = await User.findById(payment.student);
  if (payment.mode !== "test" && student?.whatsappNumber) {
    await sendWhatsApp(student.whatsappNumber, messages.paymentReceived(payment.studentAmount));
  }
  return released;
};

const releaseHeldPayment = async (paymentId, { allowDisputed = false, overrideAdminHold = false } = {}) => {
  const payment = await Payment.findById(paymentId);
  if (!payment) throw setStatusError("Payment not found", 404);
  const mode = assertPaymentMode(payment);
  if (payment.adminHold && !overrideAdminHold) throw setStatusError("An admin has placed this payment on hold", 409);

  if (payment.status === "released") {
    const gig = await Gig.findById(payment.gig).select("closedAt clientClosedAt completedAt");
    const closedAt = payment.clientClosedAt || gig?.clientClosedAt || gig?.closedAt || payment.releasedAt || gig?.completedAt || new Date();
    await Gig.findByIdAndUpdate(payment.gig, {
      status: "completed",
      paymentStatus: "released",
      completedAt: gig?.completedAt || payment.releasedAt || closedAt,
      closedAt,
      clientClosedAt: gig?.clientClosedAt || payment.clientClosedAt || closedAt
    });
    await refreshStudentEarnings(payment.student);
    return { payment, alreadyReleased: true };
  }

  const eligibleStatuses = allowDisputed ? ["paid", "escrowed", "disputed"] : ["paid", "escrowed"];
  if (!eligibleStatuses.includes(payment.status)) {
    throw setStatusError("Payment is not eligible for release", 409);
  }
  const priorStatus = payment.status;
  const claimFilter = { _id: payment._id, status: priorStatus };
  if (!overrideAdminHold) claimFilter.adminHold = { $ne: true };
  const claimed = await Payment.findOneAndUpdate(
    claimFilter,
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
    if (mode === "test") {
      const released = await finalizeRelease(payment);
      if (!released) throw new Error("Test payout could not be recorded");
      return { payment: released, alreadyReleased: false, payoutPending: false };
    }

    const { client: razorpay } = createRazorpayClient();
    if (!payment.razorpayPaymentId) throw setStatusError("Razorpay payment ID is missing; admin review is required", 409);
    const student = await User.findById(payment.student).select("razorpayAccountId role");
    if (!student || student.role !== "student" || !student.razorpayAccountId) {
      throw setStatusError("The student needs an active Razorpay Route linked account before payout can be approved", 409);
    }

    let transfer = payment.razorpayTransferId
      ? await razorpay.transfers.fetch(payment.razorpayTransferId)
      : null;
    if (transfer?.status === "failed" || transfer?.transfer_status === "failed") transfer = null;
    if (!transfer) {
      const transferCollection = await razorpay.payments.fetchTransfer(payment.razorpayPaymentId);
      const transfers = transferCollection?.items || [];
      const activeTransfers = transfers.filter((item) => item.status !== "failed" && item.transfer_status !== "failed");
      transfer = activeTransfers.find((item) =>
        item.recipient === student.razorpayAccountId && item.amount === Math.round(payment.studentAmount * 100)
      );
      if (!transfer && activeTransfers.length) {
        throw setStatusError("A different Route transfer already exists for this payment; admin review is required", 409);
      }
    }

    if (!transfer) {
      const created = await razorpay.payments.transfer(payment.razorpayPaymentId, {
        transfers: [{
          account: student.razorpayAccountId,
          amount: Math.round(payment.studentAmount * 100),
          currency: "INR",
          on_hold: false,
          notes: { gigId: String(payment.gig), paymentId: String(payment._id) }
        }]
      });
      transfer = created?.items?.find((item) => item.recipient === student.razorpayAccountId) || created?.items?.[0];
    } else if (transfer.recipient !== student.razorpayAccountId || transfer.amount !== Math.round(payment.studentAmount * 100)) {
      throw setStatusError("The existing Route transfer does not match the selected student and payout amount", 409);
    } else if (transfer.on_hold === true) {
      transfer = await razorpay.transfers.edit(transfer.id, { on_hold: false });
    }

    if (!transfer?.id) throw new Error("Razorpay did not return a transfer ID for this payout");
    const transferStatus = transfer.status || transfer.transfer_status;
    if (transferStatus === "failed") throw setStatusError("Razorpay could not create the transfer. Check the linked account and retry approval.", 502);

    await Payment.updateOne(
      { _id: payment._id, status: "releasing" },
      { $set: { razorpayTransferId: transfer.id, operationStartedAt: null } }
    );
    await Gig.findByIdAndUpdate(payment.gig, { status: "payout-processing" });

    if (transferStatus === "processed") {
      const released = await finalizeRelease(payment);
      if (!released) throw new Error("Razorpay processed the payout but the payment record could not be updated");
      return { payment: released, alreadyReleased: false, payoutPending: false };
    }

    const processingPayment = await Payment.findById(payment._id);
    return { payment: processingPayment, alreadyReleased: false, payoutPending: true };
  } catch (error) {
    await Payment.findOneAndUpdate(
      { _id: payment._id, status: "releasing" },
      { $set: { status: priorStatus, statusBeforeProcessing: "", operationStartedAt: null } }
    );
    if (mode === "live") await Gig.findByIdAndUpdate(payment.gig, { status: payment.clientClosedAt ? "pending-admin-approval" : "disputed" });
    throw error;
  }
};

const refundPayment = async (paymentId, { allowedStatuses = ["disputed"], reason = "GIG INDIA admin dispute resolution" } = {}) => {
  const payment = await Payment.findById(paymentId);
  if (!payment) throw setStatusError("Payment not found", 404);
  assertPaymentMode(payment);
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
      const { client: razorpay } = createRazorpayClient();
      refunds = await razorpay.payments.fetchMultipleRefund(payment.razorpayPaymentId, { count: 100 });
    } catch (error) {
      // No previous refund list is available; attempt the refund request below.
    }
    let refund = refunds.items?.find((item) =>
      item.amount === Math.round(payment.totalAmount * 100) &&
      item.notes?.gigId === String(payment.gig)
    );
    if (!refund) {
      const { client: razorpay } = createRazorpayClient();
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
          adminHold: false,
          adminHoldClearedAt: payment.adminHold ? refundedAt : payment.adminHoldClearedAt,
          statusBeforeProcessing: "",
          operationStartedAt: null
        }
      },
      { new: true }
    );
    if (!saved) throw new Error("Razorpay refunded the payment but the payment record could not be updated");
    await Gig.findByIdAndUpdate(payment.gig, { status: "cancelled", paymentStatus: "refunded", closedAt: refundedAt });
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
      const mode = assertPaymentMode(payment);
      if (payment.status === "releasing") {
        if (mode === "test") {
          // Test payouts are app-only state changes; never try a Route transfer
          // while recovering a test-mode release.
          await finalizeRelease(payment);
          continue;
        }
        const { client: razorpay } = createRazorpayClient();
        const transfer = payment.razorpayTransferId ? await razorpay.transfers.fetch(payment.razorpayTransferId) : null;
        const transferStatus = transfer?.status || transfer?.transfer_status;
        if (transferStatus === "processed") {
          const released = await finalizeRelease(payment);
          if (released) continue;
        }
        if (transferStatus === "failed" || !transfer) {
          const fallbackStatus = payment.statusBeforeProcessing || "paid";
          await Payment.findOneAndUpdate(
            { _id: payment._id, status: "releasing" },
            { $set: { status: fallbackStatus, statusBeforeProcessing: "", operationStartedAt: null, razorpayTransferId: "" } }
          );
          await Gig.findByIdAndUpdate(payment.gig, { status: payment.clientClosedAt ? "pending-admin-approval" : "disputed" });
          continue;
        }
        // A pending transfer is not a completed payout. The regular payment
        // maintenance poll will check it again until Razorpay processes it.
        await Payment.updateOne({ _id: payment._id, status: "releasing" }, { $set: { operationStartedAt: null } });
        continue;
      } else if (payment.status === "refunding" && payment.razorpayPaymentId) {
        const { client: razorpay } = createRazorpayClient();
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
                adminHold: false,
                adminHoldClearedAt: payment.adminHold ? refundedAt : payment.adminHoldClearedAt,
                statusBeforeProcessing: "",
                operationStartedAt: null
              }
            },
            { new: true }
          );
          if (saved) await Gig.findByIdAndUpdate(payment.gig, { status: "cancelled", paymentStatus: "refunded", closedAt: refundedAt });
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

const processPaymentMaintenance = async () => {
  await recoverStalePaymentOperations();
  const pendingTransfers = await Payment.find({
    status: "releasing",
    $or: [{ mode: "live" }, { mode: { $exists: false } }],
    razorpayTransferId: { $exists: true, $ne: "" }
  }).limit(50);

  for (const payment of pendingTransfers) {
    try {
      const { client: razorpay } = createRazorpayClient();
      const transfer = await razorpay.transfers.fetch(payment.razorpayTransferId);
      const transferStatus = transfer?.status || transfer?.transfer_status;
      if (transferStatus === "processed") {
        await finalizeRelease(payment);
      } else if (transferStatus === "failed") {
        const fallbackStatus = payment.statusBeforeProcessing || "paid";
        await Payment.findOneAndUpdate(
          { _id: payment._id, status: "releasing" },
          { $set: { status: fallbackStatus, statusBeforeProcessing: "", operationStartedAt: null, razorpayTransferId: "" } }
        );
        await Gig.findByIdAndUpdate(payment.gig, { status: payment.clientClosedAt ? "pending-admin-approval" : "disputed" });
      }
    } catch (error) {
      console.error(`Payout status check failed for payment ${payment._id}: ${error.message}`);
    }
  }
};

module.exports = { releaseHeldPayment, refundPayment, processPaymentMaintenance };
