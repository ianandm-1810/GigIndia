const User = require("../models/User");
const mongoose = require("mongoose");
const Gig = require("../models/Gig");
const { cloudinary } = require("../config/cloudinary");
const { getChatAccess } = require("../utils/chatAccess");
const { containsBlockedChatLanguage, containsPersonalContactDetails } = require("../utils/chatModeration");
const StudentConversation = require("../models/StudentConversation");

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
    if (req.user.role !== "student") return res.status(403).json({ message: "Only students can upload portfolio files" });
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
    if (req.user.role !== "student") return res.status(403).json({ message: "Only students can remove portfolio files" });
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

// @route POST /api/upload/chat-media
const uploadChatMedia = async (req, res) => {
  try {
    const { gigId, conversationId } = req.body;
    if (!req.file) return res.status(400).json({ message: "Choose an image or video to share" });
    if (Boolean(gigId) === Boolean(conversationId)) return res.status(400).json({ message: "Provide one active chat room" });

    if (conversationId) {
      if (!mongoose.isValidObjectId(conversationId)) return res.status(400).json({ message: "Invalid student chat" });
      const conversation = await StudentConversation.findOne({
        _id: conversationId,
        members: req.user._id,
        status: "accepted"
      });
      if (!conversation || req.user.role !== "student") return res.status(403).json({ message: "Only accepted student chat members can upload media" });
    } else {
      if (!mongoose.isValidObjectId(gigId)) return res.status(400).json({ message: "Valid gigId is required" });
      const gig = await Gig.findById(gigId);
      if (!gig) return res.status(404).json({ message: "Gig not found" });
      const isClient = gig.client.toString() === req.user._id.toString();
      const isAssignedStudent = gig.assignedTo && gig.assignedTo.toString() === req.user._id.toString();
      if (!gig.assignedTo || (!isClient && !isAssignedStudent)) {
        return res.status(403).json({ message: "Only the client and selected student can upload chat media" });
      }
      const chatAccess = getChatAccess(gig);
      if (!chatAccess.available) {
        return res.status(410).json({ message: "This project chat has expired", chatAccessUntil: chatAccess.expiresAt });
      }
    }
    if (containsBlockedChatLanguage(String(req.body.message || ""))) {
      return res.status(400).json({ message: "Please remove abusive or inappropriate language before sending this message." });
    }
    if (containsPersonalContactDetails(String(req.body.message || ""))) {
      return res.status(400).json({ message: "For your privacy, phone numbers and email addresses cannot be shared in chat." });
    }

    const mediaType = req.file.mimetype.startsWith("video/") ? "video" : "image";
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: "gigindia/chat", resource_type: mediaType },
        (error, uploaded) => error ? reject(error) : resolve(uploaded)
      );
      stream.end(req.file.buffer);
    });
    return res.status(201).json({ fileUrl: result.secure_url, mediaType, fileName: req.file.originalname });
  } catch (error) {
    console.error(`Chat media upload failed: ${error.message}`);
    return res.status(502).json({ message: "Could not upload that media right now. Please try again." });
  }
};

const uploadGigImage = async (req, res) => {
  try {
    if (req.user.role !== "client") return res.status(403).json({ message: "Only clients can upload gig images" });
    if (!req.file) return res.status(400).json({ message: "Choose an image to upload" });
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: "gigindia/gigs", resource_type: "image" },
        (error, uploaded) => error ? reject(error) : resolve(uploaded)
      );
      stream.end(req.file.buffer);
    });
    return res.status(201).json({ imageUrl: result.secure_url });
  } catch (error) {
    console.error(`Gig image upload failed: ${error.message}`);
    return res.status(502).json({ message: "Could not upload that image right now. Please try again." });
  }
};

module.exports = { uploadProfilePhoto, uploadPortfolioFile, deletePortfolioFile, uploadChatMedia, uploadGigImage };
