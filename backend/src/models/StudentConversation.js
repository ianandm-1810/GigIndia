const mongoose = require("mongoose");

const studentConversationSchema = new mongoose.Schema({
  members: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  }],
  memberKey: {
    type: String,
    required: true,
    unique: true
  },
  requester: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  status: {
    type: String,
    enum: ["pending", "accepted", "rejected", "blocked"],
    default: "pending"
  },
  statusChangedAt: {
    type: Date,
    default: null
  },
  statusChangedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  }
}, { timestamps: true });

studentConversationSchema.index({ members: 1, updatedAt: -1 });

module.exports = mongoose.model("StudentConversation", studentConversationSchema);
