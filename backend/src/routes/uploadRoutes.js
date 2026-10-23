const express = require("express");
const router = express.Router();
const { uploadProfilePhoto, uploadPortfolioFile, deletePortfolioFile, uploadChatMedia, uploadGigImage } = require("../controllers/uploadController");
const { protect } = require("../middleware/auth");
const { uploadProfile, uploadPortfolio } = require("../config/cloudinary");
const multer = require("multer");

const allowedGigImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const uploadGigFile = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, callback) => callback(null, allowedGigImageTypes.has(file.mimetype))
});
const handleGigImageUpload = (req, res, next) => uploadGigFile.single("image")(req, res, (error) => {
  if (!error) return next();
  if (error.code === "LIMIT_FILE_SIZE") return res.status(413).json({ message: "Gig images must be 8 MB or smaller" });
  return res.status(400).json({ message: "Choose a JPG, PNG, or WebP image" });
});

const allowedChatTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/quicktime", "video/webm"]);
const uploadChatFile = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, callback) => callback(null, allowedChatTypes.has(file.mimetype))
});
const handleChatUpload = (req, res, next) => uploadChatFile.single("file")(req, res, (error) => {
  if (!error) return next();
  if (error.code === "LIMIT_FILE_SIZE") return res.status(413).json({ message: "Chat media must be 25 MB or smaller" });
  return res.status(400).json({ message: "Choose a supported image or video file" });
});

// Profile photo upload
router.post("/profile-photo", protect, uploadProfile.single("photo"), uploadProfilePhoto);

// Portfolio file upload
router.post("/portfolio", protect, uploadPortfolio.single("file"), uploadPortfolioFile);

// Portfolio file delete
router.delete("/portfolio", protect, deletePortfolioFile);

// Chat images and videos are uploaded only after the API confirms the user is a participant.
router.post("/chat-media", protect, handleChatUpload, uploadChatMedia);
router.post("/gig-image", protect, handleGigImageUpload, uploadGigImage);

module.exports = router;
