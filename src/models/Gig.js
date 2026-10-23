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
    enum: ["open", "in-progress", "submitted", "completed", "disputed", "cancelled"],
    default: "open"
  },
  attachments: [String],
  paymentStatus: {
    type: String,
    enum: ["pending", "escrowed", "released", "refunded"],
    default: "pending"
  },
  razorpayOrderId: {
    type: String,
    default: ""
  }
}, { timestamps: true });

module.exports = mongoose.model("Gig", gigSchema);