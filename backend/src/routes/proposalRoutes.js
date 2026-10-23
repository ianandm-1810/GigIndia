const express = require("express");
const router = express.Router();
const { sendProposal, getProposals, acceptProposal } = require("../controllers/proposalController");
const { protect } = require("../middleware/auth");

// Send proposal on a gig
router.post("/:gigId", protect, sendProposal);

// Get all proposals for a gig
router.get("/:gigId", protect, getProposals);

// Accept a proposal
router.put("/:id/accept", protect, acceptProposal);

module.exports = router;