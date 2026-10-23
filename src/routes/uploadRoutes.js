const express = require("express");
const router = express.Router();
const { uploadProfilePhoto, uploadPortfolioFile, deletePortfolioFile } = require("../controllers/uploadController");
const { protect } = require("../middleware/auth");
const { uploadProfile, uploadPortfolio } = require("../config/cloudinary");

// Profile photo upload
router.post("/profile-photo", protect, uploadProfile.single("photo"), uploadProfilePhoto);

// Portfolio file upload
router.post("/portfolio", protect, uploadPortfolio.single("file"), uploadPortfolioFile);

// Portfolio file delete
router.delete("/portfolio", protect, deletePortfolioFile);

module.exports = router;