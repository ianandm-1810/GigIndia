const Gig = require("../models/Gig");
const Payment = require("../models/Payment");
const mongoose = require("mongoose");

// @route POST /api/gigs
const createGig = async (req, res) => {
  try {
    const { title, description, category, budget, deadline } = req.body;

    const gig = await Gig.create({
      title,
      description,
      category,
      budget,
      deadline,
      client: req.user._id
    });

    res.status(201).json(gig);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route GET /api/gigs
const getAllGigs = async (req, res) => {
  try {
    const { category, minBudget, maxBudget } = req.query;

    let filter = { status: "open" };

    if (category) filter.category = category;
    if (minBudget || maxBudget) {
      filter.budget = {};
      if (minBudget) filter.budget.$gte = Number(minBudget);
      if (maxBudget) filter.budget.$lte = Number(maxBudget);
    }

    const gigs = await Gig.find(filter)
      .populate("client", "name email college")
      .sort({ createdAt: -1 });

    res.json(gigs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route GET /api/gigs/:id
const getGigById = async (req, res) => {
  try {
    const gig = await Gig.findById(req.params.id)
      .select("-submissionNote -submissionAttachments -disputeReason -disputeResolutionNote")
      .populate("client", "name email college rating")
      .populate("assignedTo", "name email college rating");

    if (!gig) {
      return res.status(404).json({ message: "Gig not found" });
    }

    res.json(gig);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route GET /api/gigs/:id/submission
const getGigSubmission = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid gig ID" });
    }
    const gig = await Gig.findById(req.params.id).select(
      "client assignedTo status submissionNote submissionAttachments submittedAt disputeReason disputeResolution disputeResolutionNote"
    );
    if (!gig) return res.status(404).json({ message: "Gig not found" });

    const isParticipant = [gig.client, gig.assignedTo].some(
      (id) => id && id.toString() === req.user._id.toString()
    );
    if (!isParticipant && req.user.role !== "admin") {
      return res.status(403).json({ message: "Only the client, assigned student, or an admin can view submitted work" });
    }

    return res.json({
      gigId: gig._id,
      status: gig.status,
      submissionNote: gig.submissionNote,
      submissionAttachments: gig.submissionAttachments,
      submittedAt: gig.submittedAt,
      disputeReason: gig.disputeReason,
      disputeResolution: gig.disputeResolution,
      disputeResolutionNote: gig.disputeResolutionNote
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @route DELETE /api/gigs/:id
const deleteGig = async (req, res) => {
  try {
    const gig = await Gig.findById(req.params.id);

    if (!gig) {
      return res.status(404).json({ message: "Gig not found" });
    }

    // Sirf client hi apna gig delete kar sakta hai
    if (gig.client.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    await gig.deleteOne();
    res.json({ message: "Gig deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route POST /api/gigs/:id/submit
const submitGig = async (req, res) => {
  try {
    const { submissionNote = "", submissionAttachments = [] } = req.body;
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid gig ID" });
    }
    if (req.user.role !== "student") {
      return res.status(403).json({ message: "Only the assigned student can submit work" });
    }
    if (typeof submissionNote !== "string" || submissionNote.trim().length > 2000) {
      return res.status(400).json({ message: "Submission note must be 2000 characters or fewer" });
    }
    if (!Array.isArray(submissionAttachments) || submissionAttachments.length > 10 ||
        submissionAttachments.some((url) => typeof url !== "string" || url.length > 2048)) {
      return res.status(400).json({ message: "Submission attachments must be an array of up to 10 URLs" });
    }
    if (!submissionNote.trim() && submissionAttachments.length === 0) {
      return res.status(400).json({ message: "Add a submission note or at least one work attachment" });
    }

    const now = new Date();
    const autoReleaseAt = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
    const gig = await Gig.findOneAndUpdate(
      {
        _id: req.params.id,
        assignedTo: req.user._id,
        status: "in-progress",
        paymentStatus: "escrowed"
      },
      {
        $set: {
          status: "submitted",
          submissionNote: submissionNote.trim(),
          submissionAttachments,
          submittedAt: now
        }
      },
      { new: true, runValidators: true }
    );
    if (!gig) {
      return res.status(409).json({ message: "You must be assigned to this in-progress gig and its payment must be held before submitting" });
    }

    const payment = await Payment.findOneAndUpdate(
      { gig: gig._id, status: "escrowed" },
      { $set: { autoReleaseAt } },
      { new: true }
    );
    if (!payment) {
      await Gig.findOneAndUpdate(
        { _id: gig._id, status: "submitted", submittedAt: now },
        {
          $set: { status: "in-progress", submissionNote: "", submissionAttachments: [], submittedAt: null }
        }
      );
      return res.status(409).json({ message: "Held payment not found; submission was not accepted" });
    }

    return res.status(200).json({
      message: "Work submitted. Client approval or a dispute is needed before the five-day auto-release deadline.",
      gig,
      autoReleaseAt: payment.autoReleaseAt
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = { createGig, getAllGigs, getGigById, getGigSubmission, deleteGig, submitGig };
