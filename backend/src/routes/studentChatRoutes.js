const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const {
  searchStudents,
  requestStudentChat,
  listMyStudentChats,
  respondToStudentChat,
  getStudentChatMessages,
  sendStudentChatMessage
} = require("../controllers/studentChatController");

router.use(protect);
router.get("/search", searchStudents);
router.get("/", listMyStudentChats);
router.post("/requests", requestStudentChat);
router.patch("/:conversationId/respond", respondToStudentChat);
router.get("/:conversationId/messages", getStudentChatMessages);
router.post("/:conversationId/messages", sendStudentChatMessage);

module.exports = router;
