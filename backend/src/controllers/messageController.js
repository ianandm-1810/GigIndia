const mongoose = require("mongoose");
const Gig = require("../models/Gig");
const Message = require("../models/Message");

// @route GET /api/messages/:gigId
const getGigMessages = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.gigId)) {
      return res.status(400).json({ message: "Invalid gig id" });
    }

    const gig = await Gig.findById(req.params.gigId);
    if (!gig) {
      return res.status(404).json({ message: "Gig not found" });
    }

    const isClient = gig.client.toString() === req.user._id.toString();
    const isAssignedStudent = gig.assignedTo && gig.assignedTo.toString() === req.user._id.toString();
    if (!isClient && !isAssignedStudent) {
      return res.status(403).json({ message: "Not authorized to view this chat" });
    }

    const requestedLimit = Number.parseInt(req.query.limit, 10);
    const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 50;

    const messages = await Message.find({ gig: gig._id })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("sender", "name profilePhoto");

    res.json(messages.reverse());
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getGigMessages };
