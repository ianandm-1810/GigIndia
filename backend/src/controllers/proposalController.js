const Proposal = require("../models/Proposal");
const Gig = require("../models/Gig");
const { sendWhatsApp, messages } = require("../utils/whatsapp");
const User = require("../models/User");
const { sendEmail, emailTemplates } = require("../utils/email");
const { normalizeUsername } = require("../utils/profileFields");

const getStudentProfileForClient = async (req, res) => {
  try {
    if (req.user.role !== "client") {
      return res.status(403).json({ message: "Only clients can view applicant profiles" });
    }
    const gig = await Gig.findOne({ _id: req.params.gigId, client: req.user._id }).select("title status assignedTo");
    if (!gig) return res.status(404).json({ message: "Gig not found" });

    const student = await User.findOne({ username: normalizeUsername(req.params.username), role: "student" })
      .select("name username college bio skills profilePhoto portfolio portfolioLink socialLinks rating totalReviews");
    if (!student) return res.status(404).json({ message: "Student profile not found" });

    const acceptedProposal = await Proposal.findOne({ gig: gig._id, student: student._id, status: "accepted" });
    if (!acceptedProposal) {
      return res.status(403).json({ message: "A student's full profile is available after you accept their proposal" });
    }

    // Some older records kept the proposal as accepted but failed to persist
    // assignedTo on the gig. Repair only when no other student is assigned;
    // the accepted proposal remains the source of truth for this client's gig.
    let assignedStudentId = gig.assignedTo;
    if (!assignedStudentId) {
      const repairIsOpenAssignment = ["open", "in-progress"].includes(gig.status);
      const repairedGig = await Gig.findOneAndUpdate(
        { _id: gig._id, client: req.user._id, assignedTo: null, status: gig.status },
        { $set: {
          assignedTo: student._id,
          ...(repairIsOpenAssignment ? { status: "in-progress", agreedAmount: acceptedProposal.proposedAmount } : {})
        } },
        { new: true, runValidators: true }
      ).select("title assignedTo");
      if (repairedGig) assignedStudentId = repairedGig.assignedTo;
      else assignedStudentId = (await Gig.findById(gig._id).select("assignedTo"))?.assignedTo;
    }
    if (assignedStudentId?.toString() !== student._id.toString()) {
      return res.status(409).json({ message: "Another student is assigned to this gig. Refresh the gig page and review the current assignment." });
    }

    return res.json({ gig: { _id: gig._id, title: gig.title }, student });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const getMyProposal = async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({ message: "Only students can view their proposal" });
    }
    const proposal = await Proposal.findOne({ gig: req.params.gigId, student: req.user._id })
      .sort({ createdAt: -1 });
    return res.json({ proposal });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @route POST /api/proposals/:gigId
const sendProposal = async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({ message: "Only students can send proposals" });
    }
    const { coverLetter, proposedAmount, deliveryDays } = req.body;
    const gig = await Gig.findById(req.params.gigId);

    if (!gig) {
      return res.status(404).json({ message: "Gig not found" });
    }

    // Sirf open gigs pe proposal bhej sakte hain
    if (gig.status !== "open" || gig.isRemoved) {
      return res.status(400).json({ message: "Gig is no longer open" });
    }

    // Client apne hi gig pe proposal nahi bhej sakta
    if (gig.client.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: "You cannot propose on your own gig" });
    }

    // A student may reapply after withdrawing, but cannot duplicate an active decision.
    const existing = await Proposal.findOne({
      gig: req.params.gigId,
      student: req.user._id,
      status: { $ne: "withdrawn" }
    });
    if (existing) {
      return res.status(400).json({ message: "You already sent a proposal" });
    }

    const proposal = await Proposal.create({
      gig: req.params.gigId,
      student: req.user._id,
      coverLetter,
      proposedAmount,
      deliveryDays
    });

    res.status(201).json(proposal);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const withdrawProposal = async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({ message: "Only students can withdraw their proposal" });
    }
    const proposal = await Proposal.findById(req.params.id);
    if (!proposal) return res.status(404).json({ message: "Proposal not found" });
    if (proposal.student.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "You can withdraw only your own proposal" });
    }
    if (proposal.status !== "pending") {
      return res.status(409).json({ message: "Only a pending proposal can be withdrawn" });
    }
    const now = new Date();
    const withdrawnProposal = await Proposal.findOneAndUpdate(
      {
        _id: proposal._id,
        student: req.user._id,
        status: "pending"
      },
      { $set: { status: "withdrawn", unappliedAt: now } },
      { new: true, runValidators: true }
    );
    if (!withdrawnProposal) {
      return res.status(409).json({ message: "The proposal changed before it could be withdrawn. Refresh and check its status." });
    }
    return res.json({ message: "Proposal withdrawn", proposal: withdrawnProposal });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @route GET /api/proposals/:gigId
const getProposals = async (req, res) => {
  try {
    const gig = await Gig.findById(req.params.gigId);

    if (!gig) {
      return res.status(404).json({ message: "Gig not found" });
    }

    // Sirf gig ka client proposals dekh sakta hai
    if (gig.client.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const proposals = await Proposal.find({ gig: req.params.gigId })
      .populate("student", "name username college rating totalReviews profilePhoto");

    res.json(proposals);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route PUT /api/proposals/:id/accept
const acceptProposal = async (req, res) => {
  try {
    const proposal = await Proposal.findById(req.params.id);

    if (!proposal) {
      return res.status(404).json({ message: "Proposal not found" });
    }

    const gig = await Gig.findById(proposal.gig);

    // Sirf gig ka client accept kar sakta hai
    if (gig.client.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    if (proposal.status !== "pending" || gig.status !== "open" || gig.isRemoved) {
      return res.status(409).json({ message: "This gig or proposal is no longer available for acceptance" });
    }

    // Proposal accept karo
    const acceptedProposal = await Proposal.findOneAndUpdate(
      { _id: proposal._id, status: "pending" },
      { $set: { status: "accepted" } },
      { new: true }
    );
    if (!acceptedProposal) {
      return res.status(409).json({ message: "This proposal is no longer pending" });
    }

    // Gig update karo
    gig.status = "in-progress";
    gig.assignedTo = acceptedProposal.student;
    gig.agreedAmount = acceptedProposal.proposedAmount;
    await gig.save();

    // Baaki proposals reject karo
    await Proposal.updateMany(
      { gig: proposal.gig, _id: { $ne: proposal._id }, status: "pending" },
      { status: "rejected" }
    );
    // Tell the student they can start using the private gig chat.
    const student = await User.findById(acceptedProposal.student);
    const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
    const chatUrl = new URL(`/chat/${gig._id}`, clientUrl).toString();
    if (student) {
      if (student.whatsappNumber) {
        await sendWhatsApp(student.whatsappNumber, messages.proposalAccepted(gig.title));
      }
      try {
        await sendEmail(
          student.email,
          "Your GIG INDIA proposal was accepted",
          emailTemplates.proposalAccepted(gig.title, chatUrl)
        );
      } catch (emailError) {
        console.error(`Proposal acceptance email failed: ${emailError.message}`);
      }
    }

    res.json({ message: "Proposal accepted", proposal: acceptedProposal });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getMyProposal, getStudentProfileForClient, sendProposal, getProposals, withdrawProposal, acceptProposal };
