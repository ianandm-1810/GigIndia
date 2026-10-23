const express = require("express");
const router = express.Router();
const { createOrder, verifyPayment, closeProject, disputePayment, getMyPayments } = require("../controllers/paymentController");
const { protect } = require("../middleware/auth");

router.get("/mine", protect, getMyPayments);
router.post("/create-order", protect, createOrder);
router.post("/verify", protect, verifyPayment);
router.post("/close/:gigId", protect, closeProject);
router.post("/dispute/:gigId", protect, disputePayment);

module.exports = router;
