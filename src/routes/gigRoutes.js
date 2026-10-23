const express = require("express");
const router = express.Router();
const { createGig, getAllGigs, getGigById, deleteGig } = require("../controllers/gigController");
const { protect } = require("../middleware/auth");

// Public — koi bhi gigs dekh sakta hai
router.get("/", getAllGigs);
router.get("/:id", getGigById);

// Protected — sirf logged in user
router.post("/", protect, createGig);
router.delete("/:id", protect, deleteGig);

module.exports = router;