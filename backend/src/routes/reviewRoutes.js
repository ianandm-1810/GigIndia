const express = require("express");
const router = express.Router();
const { createReview, getUserReviews, getGigReviews } = require("../controllers/reviewController");
const { protect } = require("../middleware/auth");

router.get("/user/:userId", getUserReviews);
router.get("/gig/:gigId", getGigReviews);
router.post("/:gigId", protect, createReview);

module.exports = router;
