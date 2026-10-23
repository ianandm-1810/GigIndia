const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { body } = require("express-validator");
const { registerUser, loginUser, getMe, forgotPassword, resetPassword, deleteAccount } = require("../controllers/authController");

// Validation rules
const registerValidation = [
  body("name").notEmpty().withMessage("Name is required"),
  body("email").isEmail().withMessage("Valid email is required"),
  body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
];

const loginValidation = [
  body("email").isEmail().withMessage("Valid email is required"),
  body("password").notEmpty().withMessage("Password is required"),
];

// Routes
router.post("/register", registerValidation, registerUser);
router.post("/login", loginValidation, loginUser);
router.get("/me", protect, getMe);
router.post("/forgot-password", forgotPassword);
router.put("/reset-password/:token", resetPassword);
router.delete("/delete-account", protect, deleteAccount);
module.exports = router;