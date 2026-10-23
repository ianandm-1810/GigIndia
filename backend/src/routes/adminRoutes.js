const express = require("express");
const router = express.Router();
const {
  getDashboard,
  listUsers,
  setUserSuspension,
  setRazorpayAccount,
  listGigs,
  listPayments,
  listReviews,
  listDisputes,
  resolveDispute,
  refundPaymentAdmin,
  deleteReview
} = require("../controllers/adminController");
const { protect, adminOnly } = require("../middleware/auth");

router.use(protect, adminOnly);
router.get("/dashboard", getDashboard);
router.get("/users", listUsers);
router.patch("/users/:userId/suspension", setUserSuspension);
router.patch("/users/:userId/razorpay-account", setRazorpayAccount);
router.get("/gigs", listGigs);
router.get("/payments", listPayments);
router.get("/reviews", listReviews);
router.get("/disputes", listDisputes);
router.post("/disputes/:gigId/resolve", resolveDispute);
router.post("/payments/:gigId/refund", refundPaymentAdmin);
router.delete("/reviews/:reviewId", deleteReview);

module.exports = router;
