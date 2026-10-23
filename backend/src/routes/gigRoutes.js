const express = require("express");
const router = express.Router();
const { createGig, getAllGigs, getGigById, getGigSubmission, deleteGig, submitGig } = require("../controllers/gigController");
const { protect } = require("../middleware/auth");

// Public — koi bhi gigs dekh sakta hai
router.get("/", getAllGigs);
router.get("/:id/submission", protect, getGigSubmission);
router.get("/:id", getGigById);

// Protected — sirf logged in user
router.post("/", protect, createGig);
router.post("/:id/submit", protect, submitGig);
router.delete("/:id", protect, deleteGig);

module.exports = router;
