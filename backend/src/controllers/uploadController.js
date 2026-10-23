const User = require("../models/User");
const { cloudinary } = require("../config/cloudinary");

// @route POST /api/upload/profile-photo
const uploadProfilePhoto = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // User ka profile photo update karo
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { profilePhoto: req.file.path },
      { new: true }
    ).select("-password");

    res.json({
      message: "Profile photo uploaded",
      profilePhoto: req.file.path,
      user
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route POST /api/upload/portfolio
const uploadPortfolioFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // Portfolio array mein add karo
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $push: { portfolio: req.file.path } },
      { new: true }
    ).select("-password");

    res.json({
      message: "Portfolio file uploaded",
      fileUrl: req.file.path,
      user
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route DELETE /api/upload/portfolio
const deletePortfolioFile = async (req, res) => {
  try {
    const { fileUrl } = req.body;

    // Cloudinary se delete karo
    const publicId = fileUrl.split("/").slice(-2).join("/").split(".")[0];
    await cloudinary.uploader.destroy(publicId);

    // User ke portfolio se remove karo
    await User.findByIdAndUpdate(
      req.user._id,
      { $pull: { portfolio: fileUrl } }
    );

    res.json({ message: "File deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { uploadProfilePhoto, uploadPortfolioFile, deletePortfolioFile };