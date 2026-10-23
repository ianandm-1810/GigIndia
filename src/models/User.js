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
  skills: [String],
  bio: {
    type: String,
    maxlength: 500
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