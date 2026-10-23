const express = require("express");
const router = express.Router();
const {
  getDashboard,
  listUsers,
  setUserSuspension,
  updateUserProfile,
  removeUser,
  setRazorpayAccount,
  listGigs,
  setGigRemoval,
  deleteGigAdmin,
  getUserHistory,
  listStudentChats,
  setStudentChatStatus,
  getStudentChatMessages,
  listProposals,
  listPayments,
  listReviews,
  listDisputes,
  getGigChatMessages,
  setPaymentAdminHold,
  approvePaymentPayout,
  resolveDispute,
  refundPaymentAdmin,
  deleteReview
} = require("../controllers/adminController");
const { protect, adminOnly } = require("../middleware/auth");

router.use(protect, adminOnly);
router.get("/dashboard", getDashboard);
router.get("/users", listUsers);
router.get("/users/:userId/history", getUserHistory);
router.put("/users/:userId", updateUserProfile);
router.patch("/users/:userId/suspension", setUserSuspension);
router.delete("/users/:userId", removeUser);
router.patch("/users/:userId/razorpay-account", setRazorpayAccount);
router.get("/gigs", listGigs);
router.patch("/gigs/:gigId/removal", setGigRemoval);
router.delete("/gigs/:gigId", deleteGigAdmin);
router.get("/gigs/:gigId/messages", getGigChatMessages);
router.get("/student-chats", listStudentChats);
router.patch("/student-chats/:conversationId/status", setStudentChatStatus);
router.get("/student-chats/:conversationId/messages", getStudentChatMessages);
router.get("/proposals", listProposals);
router.get("/payments", listPayments);
router.patch("/payments/:paymentId/hold", setPaymentAdminHold);
router.post("/payments/:paymentId/approve", approvePaymentPayout);
router.get("/reviews", listReviews);
router.get("/disputes", listDisputes);
router.post("/disputes/:gigId/resolve", resolveDispute);
router.post("/payments/:gigId/refund", refundPaymentAdmin);
router.delete("/reviews/:reviewId", deleteReview);

module.exports = router;
