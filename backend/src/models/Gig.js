const mongoose = require("mongoose");

const gigSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    maxlength: 2000
  },
  category: {
    type: String,
    required: true,
    enum: ["design", "video", "coding", "writing", "social-media", "data-entry", "other"]
  },
  budget: {
    type: Number,
    required: true,
    min: 100
  },
  agreedAmount: {
    type: Number,
    min: 100,
    default: null
  },
  deadline: {
    type: Date,
    required: true
  },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  },
  status: {
    type: String,
    enum: ["open", "in-progress", "submitted", "pending-admin-approval", "payout-processing", "completed", "disputed", "cancelled"],
    default: "open"
  },
  attachments: [String],
  isRemoved: {
    type: Boolean,
    default: false
  },
  removedAt: {
    type: Date,
    default: null
  },
  removedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  },
  submissionNote: {
    type: String,
    trim: true,
    maxlength: 2000,
    default: ""
  },
  submissionLink: {
    type: String,
    trim: true,
    maxlength: 2048,
    default: ""
  },
  submissionAttachments: {
    type: [String],
    default: []
  },
  submittedAt: {
    type: Date,
    default: null
  },
  completedAt: {
    type: Date,
    default: null
  },
  closedAt: {
    type: Date,
    default: null
  },
  clientClosedAt: {
    type: Date,
    default: null
  },
  disputedAt: {
    type: Date,
    default: null
  },
  disputeReason: {
    type: String,
    trim: true,
    maxlength: 2000,
    default: ""
  },
  disputeResolution: {
    type: String,
    enum: ["release", "refund", ""],
    default: ""
  },
  disputeResolutionNote: {
    type: String,
    trim: true,
    maxlength: 2000,
    default: ""
  },
  paymentStatus: {
    type: String,
    enum: ["pending", "paid", "escrowed", "released", "refunded"],
    default: "pending"
  },
  razorpayOrderId: {
    type: String,
    default: ""
  }
}, { timestamps: true });

module.exports = mongoose.model("Gig", gigSchema);
