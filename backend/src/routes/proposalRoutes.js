const express = require("express");
const router = express.Router();
const { getMyProposal, getStudentProfileForClient, sendProposal, getProposals, withdrawProposal, acceptProposal } = require("../controllers/proposalController");
const { protect } = require("../middleware/auth");

router.get("/my/:gigId", protect, getMyProposal);
router.get("/:gigId/student/:username", protect, getStudentProfileForClient);

// Send proposal on a gig
router.post("/:gigId", protect, sendProposal);

// Get all proposals for a gig
router.get("/:gigId", protect, getProposals);

// Accept a proposal
router.put("/:id/accept", protect, acceptProposal);
router.delete("/:id", protect, withdrawProposal);

module.exports = router;
