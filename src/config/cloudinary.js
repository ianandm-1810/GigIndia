const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const multer = require("multer");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Profile photo storage
const profileStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "gigindia/profiles",
    allowed_formats: ["jpg", "jpeg", "png"],
    transformation: [{ width: 400, height: 400, crop: "fill" }]
  }
});

// Portfolio/gig file storage
const portfolioStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "gigindia/portfolio",
    allowed_formats: ["jpg", "jpeg", "png", "pdf"],
  }
});

const uploadProfile = multer({ storage: profileStorage });
const uploadPortfolio = multer({ storage: portfolioStorage });

module.exports = { cloudinary, uploadProfile, uploadPortfolio };