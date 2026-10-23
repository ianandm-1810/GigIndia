const Proposal = require("../models/Proposal");
const Gig = require("../models/Gig");
const { sendWhatsApp, messages } = require("../utils/whatsapp");
const User = require("../models/User");
const { sendEmail, emailTemplates } = require("../utils/email");

// @route POST /api/proposals/:gigId
const sendProposal = async (req, res) => {
  try {
    const { coverLetter, proposedAmount, deliveryDays } = req.body;
    const gig = await Gig.findById(req.params.gigId);

    if (!gig) {
      return res.status(404).json({ message: "Gig not found" });
    }

    // Sirf open gigs pe proposal bhej sakte hain
    if (gig.status !== "open") {
      return res.status(400).json({ message: "Gig is no longer open" });
    }

    // Client apne hi gig pe proposal nahi bhej sakta
    if (gig.client.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: "You cannot propose on your own gig" });
    }

    // Ek student ek gig pe sirf ek proposal bhej sakta hai
    const existing = await Proposal.findOne({
      gig: req.params.gigId,
      student: req.user._id
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
      .populate("student", "name email college rating skills");

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

    // Proposal accept karo
    proposal.status = "accepted";
    await proposal.save();

    // Gig update karo
    gig.status = "in-progress";
    gig.assignedTo = proposal.student;
    await gig.save();

    // Baaki proposals reject karo
    await Proposal.updateMany(
      { gig: proposal.gig, _id: { $ne: proposal._id } },
      { status: "rejected" }
    );
    // Tell the student they can start using the private gig chat.
    const student = await User.findById(proposal.student);
    const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
    const chatUrl = new URL(`/chat/${gig._id}`, clientUrl).toString();
    if (student) {
      if (student.whatsappNumber) {
        await sendWhatsApp(student.whatsappNumber, messages.proposalAccepted(gig.title));
      }
      try {
        await sendEmail(
          student.email,
          "Your GIGI India proposal was accepted",
          emailTemplates.proposalAccepted(gig.title, chatUrl)
        );
      } catch (emailError) {
        console.error(`Proposal acceptance email failed: ${emailError.message}`);
      }
    }

    res.json({ message: "Proposal accepted", proposal });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { sendProposal, getProposals, acceptProposal };
