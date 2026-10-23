const Gig = require("../models/Gig");
const Proposal = require("../models/Proposal");
const mongoose = require("mongoose");
const { getChatAccess } = require("../utils/chatAccess");
const { isTrustedCloudinaryMedia } = require("../utils/media");

const isGigImageUrl = (url) => isTrustedCloudinaryMedia(url, "image");

// @route POST /api/gigs
const createGig = async (req, res) => {
  try {
    if (req.user.role !== "client") return res.status(403).json({ message: "Only clients can post gigs" });
    const { title, description, category, budget, deadline, attachments = [] } = req.body;
    if (!Array.isArray(attachments) || attachments.length > 5 || attachments.some((url) => typeof url !== "string" || !isGigImageUrl(url))) {
      return res.status(400).json({ message: "Add up to five gig images uploaded through GIG INDIA" });
    }

    const gig = await Gig.create({
      title,
      description,
      category,
      budget,
      deadline,
      attachments,
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

    // Public browsing can include closed listings for reference and history.
    // Admin-hidden gigs stay private; the dashboard's default feed remains open-only.
    let filter = { isRemoved: { $ne: true } };
    if (req.query.includeClosed !== "true") filter.status = "open";

    if (category) filter.category = category;
    if (minBudget || maxBudget) {
      filter.budget = {};
      if (minBudget) filter.budget.$gte = Number(minBudget);
      if (maxBudget) filter.budget.$lte = Number(maxBudget);
    }

    const gigs = await Gig.find(filter)
      .populate("client", "name companyName college")
      .sort({ status: 1, createdAt: -1 });

    res.json(gigs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route GET /api/gigs/mine
// Return every gig owned by the signed-in client, including proposal summaries.
const getClientGigs = async (req, res) => {
  try {
    if (req.user.role !== "client") {
      return res.status(403).json({ message: "Only clients can view their own gigs" });
    }

    const gigs = await Gig.find({ client: req.user._id })
      .populate("assignedTo", "name username college rating")
      .sort({ createdAt: -1 });

    const gigIds = gigs.map((gig) => gig._id);
    const proposals = gigIds.length
      ? await Proposal.find({ gig: { $in: gigIds } })
          .select("gig student proposedAmount deliveryDays status createdAt")
          .populate("student", "name username college rating")
          .sort({ createdAt: -1 })
      : [];

    const summaries = new Map();
    for (const proposal of proposals) {
      const gigId = proposal.gig.toString();
      if (!summaries.has(gigId)) {
          summaries.set(gigId, { total: 0, pending: 0, accepted: 0, rejected: 0, withdrawn: 0, latest: [] });
      }

      const summary = summaries.get(gigId);
      summary.total += 1;
      if (proposal.status === "pending") summary.pending += 1;
      if (proposal.status === "accepted") summary.accepted += 1;
      if (proposal.status === "rejected") summary.rejected += 1;
      if (proposal.status === "withdrawn") summary.withdrawn += 1;
      if (summary.latest.length < 3) {
        summary.latest.push({
          _id: proposal._id,
          student: proposal.student,
          proposedAmount: proposal.proposedAmount,
          deliveryDays: proposal.deliveryDays,
          status: proposal.status,
          createdAt: proposal.createdAt
        });
      }
    }

    return res.json(gigs.map((gig) => ({
      ...gig.toObject(),
      chatAccess: getChatAccess(gig),
      proposalSummary: summaries.get(gig._id.toString()) || {
        total: 0,
        pending: 0,
        accepted: 0,
        rejected: 0,
        withdrawn: 0,
        latest: []
      }
    })));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @route GET /api/gigs/student/mine
// Return all applications and assigned work, including completed and declined history.
const getStudentGigs = async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({ message: "Only students can view their application history" });
    }

    const [proposals, assignedGigs] = await Promise.all([
      Proposal.find({ student: req.user._id }).sort({ createdAt: -1 }),
      Gig.find({ assignedTo: req.user._id }).select("_id")
    ]);
    const gigIds = [...new Set([
      ...proposals.map((proposal) => proposal.gig.toString()),
      ...assignedGigs.map((gig) => gig._id.toString())
    ])];

    if (!gigIds.length) return res.json([]);

    const gigs = await Gig.find({ _id: { $in: gigIds } })
      .select("title description category budget agreedAmount deadline client assignedTo status paymentStatus isRemoved createdAt updatedAt submittedAt completedAt closedAt submissionLink")
      .populate("client", "name college")
      .populate("assignedTo", "name college")
      .sort({ updatedAt: -1, createdAt: -1 });
    const gigById = new Map(gigs.map((gig) => [gig._id.toString(), {
      ...gig.toObject(),
      chatAccess: getChatAccess(gig)
    }]));
    const history = proposals.flatMap((proposal) => {
      const gig = gigById.get(proposal.gig.toString());
      if (!gig) return [];
      return [{
        _id: proposal._id,
        gig,
        proposal: {
          _id: proposal._id,
          status: proposal.status,
          proposedAmount: proposal.proposedAmount,
          deliveryDays: proposal.deliveryDays,
          createdAt: proposal.createdAt,
          unappliedAt: proposal.unappliedAt
        }
      }];
    });
    const proposalGigIds = new Set(proposals.map((proposal) => proposal.gig.toString()));
    for (const assignedGig of assignedGigs) {
      const gig = gigById.get(assignedGig._id.toString());
      if (gig && !proposalGigIds.has(assignedGig._id.toString())) {
        history.push({ _id: assignedGig._id, gig, proposal: null });
      }
    }
    return res.json(history);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
// @route GET /api/gigs/:id
const getGigById = async (req, res) => {
  try {
    const gig = await Gig.findById(req.params.id)
      .select("-submissionNote -submissionAttachments -disputeReason -disputeResolutionNote")
      .populate("client", "name companyName college rating bio socialLinks")
      .populate("assignedTo", "name username college rating");

    if (!gig) {
      return res.status(404).json({ message: "Gig not found" });
    }
    if (gig.isRemoved) {
      const hasApplied = req.user?.role === "student"
        ? await Proposal.exists({ gig: gig._id, student: req.user._id })
        : false;
      const canSeeRemovedHistory = req.user && (
        req.user.role === "admin" ||
        gig.client.toString() === req.user._id.toString() ||
        gig.assignedTo?.toString() === req.user._id.toString() ||
        hasApplied
      );
      if (!canSeeRemovedHistory) return res.status(404).json({ message: "Gig is no longer available" });
    }

    res.json({ ...gig.toObject(), chatAccess: getChatAccess(gig) });
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
      "client assignedTo status submissionNote submissionLink submissionAttachments submittedAt disputeReason disputeResolution disputeResolutionNote"
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
      submissionLink: gig.submissionLink,
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

    if (gig.status !== "open") {
      return res.status(409).json({ message: "Only an open listing can be withdrawn" });
    }

    // Keep the listing and its proposals in both users' history instead of
    // deleting records that students or admins may need to refer back to.
    gig.status = "cancelled";
    gig.closedAt = new Date();
    await gig.save();
    await Proposal.updateMany({ gig: gig._id, status: "pending" }, { $set: { status: "rejected" } });
    return res.json({ message: "Gig withdrawn; its history has been preserved", gig });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route POST /api/gigs/:id/submit
const submitGig = async (req, res) => {
  try {
    const { submissionNote = "", submissionLink = "", submissionAttachments = [] } = req.body;
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid gig ID" });
    }
    if (req.user.role !== "student") {
      return res.status(403).json({ message: "Only the assigned student can submit work" });
    }
    if (typeof submissionNote !== "string" || submissionNote.trim().length > 2000) {
      return res.status(400).json({ message: "Submission note must be 2000 characters or fewer" });
    }
    if (typeof submissionLink !== "string" || submissionLink.trim().length > 2048) {
      return res.status(400).json({ message: "Submission link must be 2048 characters or fewer" });
    }
    if (submissionLink.trim()) {
      try {
        const url = new URL(submissionLink.trim());
        if (!["http:", "https:"].includes(url.protocol)) throw new Error("Unsupported URL protocol");
      } catch {
        return res.status(400).json({ message: "Enter a valid http or https delivery link" });
      }
    }
    if (!Array.isArray(submissionAttachments) || submissionAttachments.length > 10 ||
        submissionAttachments.some((url) => typeof url !== "string" || url.length > 2048)) {
      return res.status(400).json({ message: "Submission attachments must be an array of up to 10 URLs" });
    }
    if (!submissionNote.trim() && !submissionLink.trim() && submissionAttachments.length === 0) {
      return res.status(400).json({ message: "Add a delivery link, note, or work attachment" });
    }

    let currentGig = await Gig.findById(req.params.id);
    if (!currentGig) return res.status(404).json({ message: "Gig not found" });

    // Repair older records where the proposal says accepted but the gig's assignedTo
    // field was not persisted. Only the accepted student can trigger this repair.
    const isAssignedStudent = currentGig.assignedTo?.toString() === req.user._id.toString();
    if (!isAssignedStudent) {
      const acceptedProposal = await Proposal.findOne({ gig: currentGig._id, student: req.user._id, status: "accepted" });
      if (!acceptedProposal || (currentGig.assignedTo && currentGig.assignedTo.toString() !== req.user._id.toString())) {
        return res.status(403).json({ message: "Your proposal has not been accepted for this gig. Only the selected student can submit work." });
      }
      currentGig = await Gig.findOneAndUpdate(
        { _id: currentGig._id, assignedTo: null, status: { $in: ["open", "in-progress"] }, paymentStatus: "pending" },
        { $set: { assignedTo: req.user._id, status: "in-progress", agreedAmount: acceptedProposal.proposedAmount } },
        { new: true, runValidators: true }
      );
      if (!currentGig) return res.status(409).json({ message: "The gig assignment changed. Refresh the page and check with the client before submitting." });
    }

    if (currentGig.status !== "in-progress") {
      return res.status(409).json({ message: `This gig is currently ${currentGig.status}; work can only be submitted while it is in progress.` });
    }
    if (currentGig.paymentStatus !== "pending") {
      return res.status(409).json({ message: "This gig already has a recorded payment or a closed project and cannot accept another submission." });
    }

    const now = new Date();
    const gig = await Gig.findOneAndUpdate(
      { _id: currentGig._id, assignedTo: req.user._id, status: "in-progress", paymentStatus: "pending" },
      {
        $set: {
          status: "submitted",
          submissionNote: submissionNote.trim(),
          submissionLink: submissionLink.trim(),
          submissionAttachments,
          submittedAt: now
        }
      },
      { new: true, runValidators: true }
    );
    if (!gig) return res.status(409).json({ message: "The gig changed while you were submitting. Refresh the page and try again." });

    return res.status(200).json({
      message: "Work submitted. The client can review your description and delivery link, then pay and close the project.",
      gig
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = { createGig, getAllGigs, getClientGigs, getStudentGigs, getGigById, getGigSubmission, deleteGig, submitGig };
