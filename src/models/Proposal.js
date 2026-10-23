const mongoose = require("mongoose");

const proposalSchema = new mongoose.Schema({
  gig: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Gig",
    required: true
  },
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  coverLetter: {
    type: String,
    required: true,
    maxlength: 1000
  },
  proposedAmount: {
    type: Number,
    required: true,
    min: 100
  },
  deliveryDays: {
    type: Number,
    required: true,
    min: 1
  },
  status: {
    type: String,
    enum: ["pending", "accepted", "rejected"],
    default: "pending"
  }
}, { timestamps: true });

module.exports = mongoose.model("Proposal", proposalSchema);