const jwt = require("jsonwebtoken");
const User = require("../models/User");

const protect = async (req, res, next) => {
  try {
    // Token header se lo
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "Not authorized, no token" });
    }

    // Token verify karo
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // User DB se lo, password chhod ke
    req.user = await User.findById(decoded.id).select("-password");

    if (!req.user || req.user.isRemoved) {
      return res.status(401).json({ message: "Account not found" });
    }

    if (req.user.isSuspended) {
      return res.status(403).json({ message: "This account is suspended" });
    }

    next();
  } catch (error) {
    res.status(401).json({ message: "Not authorized, token failed" });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    res.status(403).json({ message: "Admin access only" });
  }
};

const optionalProtect = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return next();
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");
    if (user && !user.isRemoved && !user.isSuspended) req.user = user;
    return next();
  } catch (error) {
    return next();
  }
};

module.exports = { protect, adminOnly, optionalProtect };
