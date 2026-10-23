const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const authRoutes = require("./routes/authRoutes");
const gigRoutes = require("./routes/gigRoutes");
const proposalRoutes = require("./routes/proposalRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const messageRoutes = require("./routes/messageRoutes");
const adminRoutes = require("./routes/adminRoutes");
const reviewRoutes = require("./routes/reviewRoutes");
const supportRoutes = require("./routes/supportRoutes");
const rateLimit = require("express-rate-limit");
const app = express();

// Security middleware
app.use(helmet());
// Rate limiting — 100 requests per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { message: "Too many requests, please try again later" }
});
app.use("/api", limiter);

// Strict limit for auth routes — 10 tries per 15 minutes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: "Too many login attempts, please try again later" }
});
app.use("/api/auth", authLimiter);
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:5173",
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/api/proposals", proposalRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/support", supportRoutes);

app.use("/api/auth", authRoutes);
app.use("/api/gigs", gigRoutes);

app.get("/", (req, res) => {
  res.json({ message: "GIG INDIA API is running 🚀" });
});
// Custom 404 — koi bhi route match nahi hua
app.use((req, res) => {
  res.status(404).json({
    message: "Route not found",
    status: 404
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    message: err.message || "Internal Server Error",
    status: err.status || 500
  });
});
module.exports = app;
