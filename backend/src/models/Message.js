const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  gig: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Gig",
    default: null
  },
  conversation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "StudentConversation",
    default: null
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  message: {
    type: String,
    trim: true
  },
  fileUrl: {
    type: String,
    default: ""
  },
  mediaType: {
    type: String,
    enum: ["", "image", "video"],
    default: ""
  },
  isRead: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

messageSchema.pre("validate", function validateMessageTarget(next) {
  if (Boolean(this.gig) === Boolean(this.conversation)) {
    return next(new Error("A message must belong to exactly one gig or student conversation"));
  }
  return next();
});

messageSchema.index({ gig: 1, createdAt: 1 });
messageSchema.index({ conversation: 1, createdAt: 1 });

module.exports = mongoose.model("Message", messageSchema);
