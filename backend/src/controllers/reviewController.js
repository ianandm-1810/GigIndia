const mongoose = require("mongoose");
const Review = require("../models/Review");
const Gig = require("../models/Gig");
const Payment = require("../models/Payment");
const { refreshUserRating } = require("../utils/reviewService");

const pagination = (query) => {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(query.limit, 10) || 20));
  return { page, limit, skip: (page - 1) * limit };
};

// POST /api/reviews/:gigId
const createReview = async (req, res) => {
  try {
    const { rating, comment = "" } = req.body;
    if (!mongoose.isValidObjectId(req.params.gigId)) {
      return res.status(400).json({ message: "Invalid gig ID" });
    }
    if (!Number.isInteger(Number(rating)) || Number(rating) < 1 || Number(rating) > 5) {
      return res.status(400).json({ message: "Rating must be a whole number from 1 to 5" });
    }
    if (typeof comment !== "string" || comment.trim().length > 1000) {
      return res.status(400).json({ message: "Review comment must be 1000 characters or fewer" });
    }

    const gig = await Gig.findById(req.params.gigId);
    if (!gig) return res.status(404).json({ message: "Gig not found" });
    const payment = await Payment.findOne({ gig: gig._id, status: "released" });
    if (gig.status !== "completed" || gig.paymentStatus !== "released" || !payment) {
      return res.status(409).json({ message: "Reviews are available after the work is completed and its payment is released" });
    }

    const reviewerId = req.user._id.toString();
    let reviewee;
    if (gig.client.toString() === reviewerId) {
      reviewee = gig.assignedTo;
    } else if (gig.assignedTo?.toString() === reviewerId) {
      reviewee = gig.client;
    } else {
      return res.status(403).json({ message: "Only the client and assigned student can review this gig" });
    }

    const review = await Review.create({
      gig: gig._id,
      reviewer: req.user._id,
      reviewee,
      rating: Number(rating),
      comment: comment.trim()
    });
    await refreshUserRating(reviewee);
    return res.status(201).json({ message: "Review submitted", review });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "You have already reviewed this gig" });
    }
    return res.status(500).json({ message: error.message });
  }
};

// GET /api/reviews/user/:userId
const getUserReviews = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }
    const { page, limit, skip } = pagination(req.query);
    const filter = { reviewee: req.params.userId };
    const [reviews, total] = await Promise.all([
      Review.find(filter)
        .populate("reviewer", "name college profilePhoto")
        .populate("gig", "title")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Review.countDocuments(filter)
    ]);
    return res.json({ reviews, page, limit, total });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// GET /api/reviews/gig/:gigId
const getGigReviews = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.gigId)) {
      return res.status(400).json({ message: "Invalid gig ID" });
    }
    const reviews = await Review.find({ gig: req.params.gigId })
      .populate("reviewer", "name college profilePhoto")
      .populate("reviewee", "name college profilePhoto rating")
      .sort({ createdAt: 1 });
    return res.json(reviews);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = { createReview, getUserReviews, getGigReviews };
