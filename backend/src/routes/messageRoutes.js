const express = require("express");
const router = express.Router();
const { getGigMessages } = require("../controllers/messageController");
const { protect } = require("../middleware/auth");

router.get("/:gigId", protect, getGigMessages);

module.exports = router;
