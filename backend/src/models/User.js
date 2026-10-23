const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  username: {
    type: String,
    lowercase: true,
    trim: true,
    minlength: 3,
    maxlength: 24,
    match: /^[a-z0-9][a-z0-9_-]{1,22}[a-z0-9]$/,
    unique: true,
    sparse: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  role: {
    type: String,
    enum: ["student", "client", "admin"],
    default: "student"
  },
  college: {
    type: String,
    trim: true
  },
  companyName: {
    type: String,
    trim: true,
    maxlength: 160,
    default: ""
  },
  skills: [String],
  bio: {
    type: String,
    maxlength: 500
  },
  socialLinks: {
    github: { type: String, trim: true, maxlength: 2048, default: "" },
    linkedin: { type: String, trim: true, maxlength: 2048, default: "" },
    instagram: { type: String, trim: true, maxlength: 2048, default: "" },
    discord: { type: String, trim: true, maxlength: 2048, default: "" }
  },
  portfolioLink: {
    type: String,
    trim: true,
    maxlength: 2048,
    default: ""
  },
  profilePhoto: {
    type: String,
    default: ""
  },
  portfolio: [String],
  rating: {
    type: Number,
    default: 0
  },
  totalReviews: {
    type: Number,
    default: 0
  },
  totalEarnings: {
    type: Number,
    default: 0
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  isSuspended: {
    type: Boolean,
    default: false
  },
  isRemoved: {
    type: Boolean,
    default: false
  },
  removedAt: {
    type: Date,
    default: null
  },
  // Razorpay Route linked-account ID (acc_...). This is not an API secret.
  razorpayAccountId: {
    type: String,
    trim: true,
    default: ""
  },
   whatsappNumber: {
    type: String,
    trim: true
  },
  resetPasswordToken: {
    type: String,
    select: false
  },
  resetPasswordExpire: {
    type: Date,
    select: false
  }

}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
