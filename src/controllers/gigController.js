const Gig = require("../models/Gig");

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

module.exports = { createGig, getAllGigs, getGigById, deleteGig };