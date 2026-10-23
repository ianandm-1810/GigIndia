const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { body } = require("express-validator");
const { registerUser, loginUser, getMe, getUsernameAvailability, updateProfile, forgotPassword, resetPassword, deleteAccount } = require("../controllers/authController");

// Validation rules
const registerValidation = [
  body("name")
    .notEmpty().withMessage("Name is required")
    .isLength({ min: 2 }).withMessage("Name must be at least 2 characters"),
    
  body("email")
    .isEmail().withMessage("Valid email is required")
    .normalizeEmail(),
    
  body("password")
    .isLength({ min: 8 }).withMessage("Password must be at least 8 characters")
    .matches(/[A-Z]/).withMessage("Password must contain at least one uppercase letter")
    .matches(/[a-z]/).withMessage("Password must contain at least one lowercase letter")
    .matches(/[0-9]/).withMessage("Password must contain at least one number")
    .matches(/[!@#$%^&*]/).withMessage("Password must contain at least one special character"),
];

const loginValidation = [
  body("email").isEmail().withMessage("Valid email is required"),
  body("password").notEmpty().withMessage("Password is required"),
];

// Routes
router.post("/register", registerValidation, registerUser);
router.post("/login", loginValidation, loginUser);
router.get("/me", protect, getMe);
router.get("/username-availability", protect, getUsernameAvailability);
router.put("/profile", protect, updateProfile);
router.post("/forgot-password", forgotPassword);
router.put("/reset-password/:token", resetPassword);
router.delete("/delete-account", protect, deleteAccount);
module.exports = router;
