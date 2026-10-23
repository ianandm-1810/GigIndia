const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema({
  gig: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Gig",
    required: true
  },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  totalAmount: {
    type: Number,
    required: true
  },
  platformFee: {
    type: Number,
    required: true
  },
  studentAmount: {
    type: Number,
    required: true
  },
  razorpayOrderId: {
    type: String,
    required: true
  },
  razorpayPaymentId: {
    type: String,
    default: ""
  },
  paidAt: {
    type: Date,
    default: null
  },
  clientClosedAt: {
    type: Date,
    default: null
  },
  razorpayTransferId: {
    type: String,
    default: ""
  },
  razorpayRefundId: {
    type: String,
    default: ""
  },
  status: {
    type: String,
    enum: ["created", "paid", "escrowed", "releasing", "refunding", "released", "refunded", "disputed"],
    default: "created"
  },
  mode: {
    type: String,
    enum: ["test", "live"],
    default: "live"
  },
  autoReleaseAt: {
    type: Date,
    default: null
  },
  adminHold: {
    type: Boolean,
    default: false
  },
  adminHoldReason: {
    type: String,
    trim: true,
    maxlength: 500,
    default: ""
  },
  adminHeldBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  },
  adminHeldAt: {
    type: Date,
    default: null
  },
  adminHoldClearedAt: {
    type: Date,
    default: null
  },
  releasedAt: {
    type: Date,
    default: null
  },
  refundedAt: {
    type: Date,
    default: null
  },
  statusBeforeProcessing: {
    type: String,
    enum: ["paid", "escrowed", "disputed", ""],
    default: ""
  },
  operationStartedAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

module.exports = mongoose.model("Payment", paymentSchema);
