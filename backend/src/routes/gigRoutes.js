const express = require("express");
const router = express.Router();
const { createGig, getAllGigs, getClientGigs, getStudentGigs, getGigById, getGigSubmission, deleteGig, submitGig } = require("../controllers/gigController");
const { protect, optionalProtect } = require("../middleware/auth");

// Public — koi bhi gigs dekh sakta hai
router.get("/", getAllGigs);
router.get("/mine", protect, getClientGigs);
router.get("/student/mine", protect, getStudentGigs);
router.get("/:id/submission", protect, getGigSubmission);
router.get("/:id", optionalProtect, getGigById);

// Protected — sirf logged in user
router.post("/", protect, createGig);
router.post("/:id/submit", protect, submitGig);
router.delete("/:id", protect, deleteGig);

module.exports = router;
