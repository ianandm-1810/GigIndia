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
  autoReleaseAt: {
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
