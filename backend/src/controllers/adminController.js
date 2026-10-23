const mongoose = require("mongoose");
const User = require("../models/User");
const Gig = require("../models/Gig");
const Payment = require("../models/Payment");
const Review = require("../models/Review");
const { releaseHeldPayment, refundPayment } = require("../utils/paymentService");
const { refreshUserRating } = require("../utils/reviewService");

const pageOptions = (query) => {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 25));
  return { page, limit, skip: (page - 1) * limit };
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getDashboard = async (req, res) => {
  try {
    const [userCount, studentCount, clientCount, gigCount, disputedGigs, paymentStats] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: "student" }),
      User.countDocuments({ role: "client" }),
      Gig.countDocuments(),
      Gig.countDocuments({ status: "disputed" }),
      Payment.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 }, total: { $sum: "$totalAmount" } } }
      ])
    ]);
    return res.json({
      users: { total: userCount, students: studentCount, clients: clientCount },
      gigs: { total: gigCount, disputed: disputedGigs },
      payments: paymentStats.reduce((result, item) => {
        result[item._id] = { count: item.count, totalAmount: item.total };
        return result;
      }, {})
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const listUsers = async (req, res) => {
  try {
    const { page, limit, skip } = pageOptions(req.query);
    const filter = {};
    if (["student", "client", "admin"].includes(req.query.role)) filter.role = req.query.role;
    if (req.query.status === "suspended") filter.isSuspended = true;
    if (req.query.status === "active") filter.isSuspended = { $ne: true };
    if (typeof req.query.search === "string" && req.query.search.trim()) {
      const search = new RegExp(escapeRegex(req.query.search.trim().slice(0, 100)), "i");
      filter.$or = [{ name: search }, { email: search }, { college: search }];
    }
    const [users, total] = await Promise.all([
      User.find(filter).select("-password -resetPasswordToken -resetPasswordExpire")
        .sort({ createdAt: -1 }).skip(skip).limit(limit),
      User.countDocuments(filter)
    ]);
    return res.json({ users, page, limit, total });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const setUserSuspension = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.userId)) return res.status(400).json({ message: "Invalid user ID" });
    const { suspended } = req.body;
    if (typeof suspended !== "boolean") return res.status(400).json({ message: "suspended must be true or false" });
    if (req.params.userId === req.user._id.toString()) {
      return res.status(409).json({ message: "You cannot suspend your own admin account" });
    }
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.role === "admin") return res.status(409).json({ message: "Admin accounts cannot be suspended from this endpoint" });
    user.isSuspended = suspended;
    await user.save();
    return res.json({ message: suspended ? "User suspended" : "User reactivated", user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isSuspended: user.isSuspended
    } });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const setRazorpayAccount = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.userId)) return res.status(400).json({ message: "Invalid user ID" });
    const { razorpayAccountId } = req.body;
    if (typeof razorpayAccountId !== "string" || !/^acc_[A-Za-z0-9]+$/.test(razorpayAccountId.trim())) {
      return res.status(400).json({ message: "Provide the student's Razorpay Route linked-account ID (acc_...)" });
    }
    const user = await User.findOneAndUpdate(
      { _id: req.params.userId, role: "student" },
      { $set: { razorpayAccountId: razorpayAccountId.trim() } },
      { new: true }
    ).select("name email role razorpayAccountId");
    if (!user) return res.status(404).json({ message: "Student not found" });
    return res.json({ message: "Razorpay Route linked-account ID saved", user });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const listGigs = async (req, res) => {
  try {
    const validStatuses = ["open", "in-progress", "submitted", "completed", "disputed", "cancelled"];
    const { page, limit, skip } = pageOptions(req.query);
    const filter = {};
    if (validStatuses.includes(req.query.status)) filter.status = req.query.status;
    if (typeof req.query.search === "string" && req.query.search.trim()) {
      filter.title = new RegExp(escapeRegex(req.query.search.trim().slice(0, 100)), "i");
    }
    const [gigs, total] = await Promise.all([
      Gig.find(filter).populate("client", "name email").populate("assignedTo", "name email")
        .sort({ createdAt: -1 }).skip(skip).limit(limit),
      Gig.countDocuments(filter)
    ]);
    return res.json({ gigs, page, limit, total });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const listPayments = async (req, res) => {
  try {
    const validStatuses = ["created", "paid", "escrowed", "releasing", "refunding", "released", "refunded", "disputed"];
    const { page, limit, skip } = pageOptions(req.query);
    const filter = {};
    if (validStatuses.includes(req.query.status)) filter.status = req.query.status;
    const [payments, total] = await Promise.all([
      Payment.find(filter)
        .populate("gig", "title status paymentStatus")
        .populate("client", "name email")
        .populate("student", "name email razorpayAccountId")
        .sort({ createdAt: -1 }).skip(skip).limit(limit),
      Payment.countDocuments(filter)
    ]);
    return res.json({ payments, page, limit, total });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const listReviews = async (req, res) => {
  try {
    const { page, limit, skip } = pageOptions(req.query);
    const filter = {};
    if (mongoose.isValidObjectId(req.query.userId)) filter.reviewee = req.query.userId;
    if (mongoose.isValidObjectId(req.query.gigId)) filter.gig = req.query.gigId;
    const [reviews, total] = await Promise.all([
      Review.find(filter)
        .populate("reviewer", "name email")
        .populate("reviewee", "name email rating totalReviews")
        .populate("gig", "title")
        .sort({ createdAt: -1 }).skip(skip).limit(limit),
      Review.countDocuments(filter)
    ]);
    return res.json({ reviews, page, limit, total });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const listDisputes = async (req, res) => {
  try {
    const payments = await Payment.find({ status: "disputed" })
      .populate({ path: "gig", select: "title status disputeReason disputedAt client assignedTo" })
      .populate("client", "name email")
      .populate("student", "name email")
      .sort({ updatedAt: 1 });
    return res.json({ disputes: payments });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const resolveDispute = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.gigId)) return res.status(400).json({ message: "Invalid gig ID" });
    const { resolution, note = "" } = req.body;
    if (!["release", "refund"].includes(resolution)) {
      return res.status(400).json({ message: "resolution must be 'release' or 'refund'" });
    }
    if (typeof note !== "string" || note.trim().length > 2000) {
      return res.status(400).json({ message: "Resolution note must be 2000 characters or fewer" });
    }
    const gig = await Gig.findById(req.params.gigId);
    if (!gig) return res.status(404).json({ message: "Gig not found" });
    const payment = await Payment.findOne({ gig: gig._id, status: "disputed" });
    if (!payment || gig.status !== "disputed") {
      return res.status(409).json({ message: "No open dispute exists for this gig" });
    }

    let result;
    if (resolution === "release") {
      result = await releaseHeldPayment(payment._id, { allowDisputed: true });
    } else {
      result = await refundPayment(payment._id, {
        allowedStatuses: ["disputed"],
        reason: note.trim() || "GIGI India admin dispute resolution"
      });
    }

    await Gig.findByIdAndUpdate(gig._id, {
      $set: {
        disputeResolution: resolution,
        disputeResolutionNote: note.trim()
      }
    });
    return res.json({
      message: resolution === "release" ? "Dispute resolved; held Route transfer released" : "Dispute resolved; customer refund requested",
      resolution,
      payment: result.payment
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.statusCode ? error.message : "Dispute resolution failed. Check the payment provider and retry."
    });
  }
};

const refundPaymentAdmin = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.gigId)) return res.status(400).json({ message: "Invalid gig ID" });
    const { reason } = req.body;
    if (typeof reason !== "string" || !reason.trim() || reason.trim().length > 200) {
      return res.status(400).json({ message: "A refund reason of 1–200 characters is required" });
    }
    const payment = await Payment.findOne({ gig: req.params.gigId, status: { $in: ["paid", "escrowed"] } });
    if (!payment) return res.status(404).json({ message: "No paid or held payment was found for this gig" });
    const result = await refundPayment(payment._id, {
      allowedStatuses: ["paid", "escrowed"],
      reason: reason.trim()
    });
    return res.json({ message: "Customer refund requested through Razorpay", payment: result.payment });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.statusCode ? error.message : "Refund failed. Check Razorpay and retry."
    });
  }
};

const deleteReview = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.reviewId)) return res.status(400).json({ message: "Invalid review ID" });
    const review = await Review.findByIdAndDelete(req.params.reviewId);
    if (!review) return res.status(404).json({ message: "Review not found" });
    await refreshUserRating(review.reviewee);
    return res.json({ message: "Review removed and user rating recalculated" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getDashboard,
  listUsers,
  setUserSuspension,
  setRazorpayAccount,
  listGigs,
  listPayments,
  listReviews,
  listDisputes,
  resolveDispute,
  refundPaymentAdmin,
  deleteReview
};
