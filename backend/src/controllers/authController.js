const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { validationResult } = require("express-validator");
const { USERNAME_PATTERN, normalizeUsername, createAvailableUsername, normalizeHttpUrl, normalizeSocialLinks } = require("../utils/profileFields");

// Generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "30d" });
};

// @route POST /api/auth/register
const registerUser = async (req, res) => {
  try {
    const errors = validationResult(req);
if (!errors.isEmpty()) {
  return res.status(400).json({ errors: errors.array() });
}
    const { name, email, password, role, college, whatsappNumber, username } = req.body;

    // Check karo user pehle se exist karta hai ya nahi
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Password hash karo
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const initialUsername = username
      ? normalizeUsername(username)
      : await createAvailableUsername(name);
    if (!USERNAME_PATTERN.test(initialUsername)) {
      return res.status(400).json({ message: "Username must be 3–24 characters using letters, numbers, _ or -, and start and end with a letter or number" });
    }
    if (await User.exists({ username: initialUsername })) {
      return res.status(409).json({ message: "That username is already taken. Choose another one." });
    }

    // User banao
    const user = await User.create({
      name,
      username: initialUsername,
      email,
      password: hashedPassword,
      role: ["student", "client"].includes(role) ? role : "student",
      college,
      whatsappNumber
    });

    res.status(201).json({
      _id: user._id,
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role,
      token: generateToken(user._id)
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route POST /api/auth/login
const loginUser = async (req, res) => {
  try {
    const errors = validationResult(req);
if (!errors.isEmpty()) {
  return res.status(400).json({ errors: errors.array() });
}
    const { email, password } = req.body;

    // User dhundo
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (user.isRemoved) {
      return res.status(403).json({ message: "This account has been removed from GIG INDIA" });
    }
    if (user.isSuspended) {
      return res.status(403).json({ message: "This account is suspended. Contact GIG INDIA support." });
    }

    // Password match karo
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (!user.username) {
      user.username = await createAvailableUsername(user.name, user._id);
      await user.save();
    }

    res.json({
      _id: user._id,
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role,
      token: generateToken(user._id)
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route GET /api/auth/me
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");
    if (user && !user.username) {
      user.username = await createAvailableUsername(user.name, user._id);
      await user.save();
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getUsernameAvailability = async (req, res) => {
  if (req.user.role !== "student") {
    return res.status(403).json({ message: "Only students can edit student usernames" });
  }
  const username = normalizeUsername(req.query.username);
  if (!USERNAME_PATTERN.test(username)) {
    return res.json({ available: false, message: "Use 3–24 letters, numbers, _ or -; begin and end with a letter or number." });
  }
  try {
    const existing = await User.exists({ username, _id: { $ne: req.user._id } });
    return res.json({ available: !existing, username });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const updateProfile = async (req, res) => {
  try {
    const updates = {};
    if (req.body.username !== undefined && req.user.role !== "student") {
      return res.status(403).json({ message: "Only students can edit their username" });
    }
    if (req.body.username !== undefined) {
      const username = normalizeUsername(req.body.username);
      if (!USERNAME_PATTERN.test(username)) {
        return res.status(400).json({ message: "Username must be 3–24 characters using letters, numbers, _ or -, and start and end with a letter or number" });
      }
      const existing = await User.exists({ username, _id: { $ne: req.user._id } });
      if (existing) return res.status(409).json({ message: "That username is already taken. Choose another one." });
      updates.username = username;
    }
    if (req.body.bio !== undefined) {
      if (typeof req.body.bio !== "string" || req.body.bio.trim().length > 500) {
        return res.status(400).json({ message: "About text must be 500 characters or fewer" });
      }
      updates.bio = req.body.bio.trim();
    }
    if (req.body.portfolioLink !== undefined) {
      if (typeof req.body.portfolioLink !== "string" || req.body.portfolioLink.length > 2048) {
        return res.status(400).json({ message: "Portfolio link must be 2048 characters or fewer" });
      }
      const portfolioLink = normalizeHttpUrl(req.body.portfolioLink);
      if (portfolioLink === null) return res.status(400).json({ message: "Enter a valid http or https portfolio link" });
      updates.portfolioLink = portfolioLink;
    }
    if (req.body.socialLinks !== undefined) {
      const result = normalizeSocialLinks(req.body.socialLinks);
      if (result.error) return res.status(400).json({ message: result.error });
      updates.socialLinks = result.socialLinks;
    }
    if (req.body.skills !== undefined) {
      if (req.user.role !== "student") return res.status(403).json({ message: "Only students can edit skills" });
      if (!Array.isArray(req.body.skills) || req.body.skills.length > 20 || req.body.skills.some((skill) => typeof skill !== "string" || skill.trim().length > 40)) {
        return res.status(400).json({ message: "Add up to 20 skills, each 40 characters or fewer" });
      }
      updates.skills = [...new Set(req.body.skills.map((skill) => skill.trim()).filter(Boolean))];
    }
    if (req.body.companyName !== undefined) {
      if (req.user.role !== "client") return res.status(403).json({ message: "Only clients can edit their company or organization name" });
      if (typeof req.body.companyName !== "string" || req.body.companyName.trim().length > 160) {
        return res.status(400).json({ message: "Company / organization name must be 160 characters or fewer" });
      }
      updates.companyName = req.body.companyName.trim();
    }

    const user = await User.findByIdAndUpdate(req.user._id, { $set: updates }, { new: true, runValidators: true }).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    return res.json(user);
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "That username is already taken. Choose another one." });
    return res.status(500).json({ message: error.message });
  }
};
const crypto = require("crypto");
const { sendEmail, emailTemplates } = require("../utils/email");

// @route DELETE /api/auth/delete-account
const deleteAccount = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Password confirm karo pehle — security ke liye
    const isMatch = await bcrypt.compare(req.body.password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Incorrect password" });
    }

    await user.deleteOne();
    res.json({ message: "Account deleted successfully" });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route POST /api/auth/forgot-password
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "No user with that email" });
    }

    // Reset token generate karo
    const resetToken = crypto.randomBytes(32).toString("hex");

    // Token hash karke DB mein save karo
    user.resetPasswordToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    // 10 minute expiry
    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000;
    await user.save();

    // Reset URL
    const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;

    // Email bhejo
    await sendEmail(
      user.email,
      "GIG INDIA Password Reset",
      emailTemplates.passwordReset(resetUrl)
    );

    res.json({ message: "Password reset email sent" });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route PUT /api/auth/reset-password/:token
const resetPassword = async (req, res) => {
  try {
    // Token hash karo aur DB se match karo
    const resetPasswordToken = crypto
      .createHash("sha256")
      .update(req.params.token)
      .digest("hex");

    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    // Naya password set karo
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(req.body.password, salt);

    // Token clear karo
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    res.json({ message: "Password reset successful" });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { 
  registerUser, 
  loginUser, 
  getMe, 
  getUsernameAvailability,
  updateProfile,
  forgotPassword, 
  resetPassword,
  deleteAccount
};
