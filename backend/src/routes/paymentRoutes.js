const express = require("express");
const router = express.Router();
const { createOrder, verifyPayment, releasePayment, disputePayment } = require("../controllers/paymentController");
const { protect } = require("../middleware/auth");

router.post("/create-order", protect, createOrder);
router.post("/verify", protect, verifyPayment);
router.post("/release/:gigId", protect, releasePayment);
router.post("/dispute/:gigId", protect, disputePayment);

module.exports = router;
