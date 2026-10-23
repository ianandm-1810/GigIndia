const express = require("express");
const rateLimit = require("express-rate-limit");
const { body } = require("express-validator");
const { createSupportRequest } = require("../controllers/supportController");

const router = express.Router();

const supportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many support requests. Please try again later." }
});

router.post("/", supportLimiter, [
  body("name").trim().isLength({ min: 2, max: 100 }).withMessage("Name must be between 2 and 100 characters"),
  body("email").trim().isEmail().withMessage("Enter a valid email address").normalizeEmail(),
  body("role").isIn(["student", "client"]).withMessage("Choose student or client"),
  body("topic").isIn(["Account access", "Gig or proposal", "Private chat", "Other"]).withMessage("Choose a support topic"),
  body("message").trim().isLength({ min: 15, max: 4000 }).withMessage("Message must be between 15 and 4000 characters")
], createSupportRequest);

module.exports = router;
