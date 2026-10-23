const mongoose = require("mongoose");
const User = require("../models/User");
const Message = require("../models/Message");
const StudentConversation = require("../models/StudentConversation");
const { USERNAME_PATTERN, normalizeUsername } = require("../utils/profileFields");
const { containsBlockedChatLanguage, containsPersonalContactDetails } = require("../utils/chatModeration");
const { isTrustedCloudinaryMedia } = require("../utils/media");

const requireStudent = (req, res) => {
  if (req.user.role === "student") return true;
  res.status(403).json({ message: "Student-to-student chat is available to student accounts" });
  return false;
};

const safeMemberFields = "name username profilePhoto";

const searchStudents = async (req, res) => {
  if (!requireStudent(req, res)) return;
  const username = normalizeUsername(req.query.username);
  if (username.length < 2 || username.length > 24) return res.json({ users: [] });
  try {
    const search = new RegExp(`^${username.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`);
    const users = await User.find({
      role: "student",
      _id: { $ne: req.user._id },
      username: search,
      isSuspended: { $ne: true },
      isRemoved: { $ne: true }
    }).select(safeMemberFields).sort({ username: 1 }).limit(10);
    return res.json({ users });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const requestStudentChat = async (req, res) => {
  if (!requireStudent(req, res)) return;
  const username = normalizeUsername(req.body.username);
  if (!USERNAME_PATTERN.test(username)) return res.status(400).json({ message: "Enter a valid student username" });
  try {
    const recipient = await User.findOne({
      username,
      role: "student",
      isSuspended: { $ne: true },
      isRemoved: { $ne: true }
    }).select("_id name username profilePhoto");
    if (!recipient) return res.status(404).json({ message: "No active student account was found for that username" });
    if (recipient._id.equals(req.user._id)) return res.status(400).json({ message: "You cannot send a chat request to yourself" });

    const memberIds = [req.user._id.toString(), recipient._id.toString()].sort();
    const memberKey = memberIds.join(":");
    let conversation = await StudentConversation.findOne({ memberKey });
    if (conversation?.status === "blocked") return res.status(403).json({ message: "This student chat is blocked by an admin" });
    if (conversation?.status === "accepted") return res.status(200).json({ message: "This chat is already available", conversation });
    if (conversation?.status === "pending") {
      return res.status(200).json({ message: conversation.recipient.equals(req.user._id) ? "A request from this student is waiting for your response" : "Your chat request is already waiting for a response", conversation });
    }

    conversation = await StudentConversation.findOneAndUpdate(
      { memberKey },
      {
        $set: {
          members: memberIds,
          requester: req.user._id,
          recipient: recipient._id,
          status: "pending",
          statusChangedAt: new Date(),
          statusChangedBy: req.user._id
        },
        $setOnInsert: { memberKey }
      },
      { new: true, upsert: true, runValidators: true }
    );
    req.app.get("io")?.to(`user:${recipient._id}`).emit("studentChatRequest");
    return res.status(201).json({ message: "Chat request sent", conversation });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "A chat request between these students already exists" });
    return res.status(500).json({ message: error.message });
  }
};

const listMyStudentChats = async (req, res) => {
  if (!requireStudent(req, res)) return;
  try {
    const conversations = await StudentConversation.find({ members: req.user._id })
      .populate("members", safeMemberFields)
      .sort({ updatedAt: -1 });
    return res.json({ conversations });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const respondToStudentChat = async (req, res) => {
  if (!requireStudent(req, res)) return;
  if (!mongoose.isValidObjectId(req.params.conversationId)) return res.status(400).json({ message: "Invalid chat request" });
  const action = req.body.action;
  if (!["accept", "reject"].includes(action)) return res.status(400).json({ message: "Choose accept or reject" });
  try {
    const conversation = await StudentConversation.findOne({
      _id: req.params.conversationId,
      recipient: req.user._id,
      status: "pending"
    });
    if (!conversation) return res.status(404).json({ message: "This pending chat request was not found" });
    conversation.status = action === "accept" ? "accepted" : "rejected";
    conversation.statusChangedAt = new Date();
    conversation.statusChangedBy = req.user._id;
    await conversation.save();
    await conversation.populate("members", safeMemberFields);
    req.app.get("io")?.to(`user:${conversation.requester}`).emit("studentChatStatus");
    return res.json({ message: action === "accept" ? "Student chat accepted" : "Chat request declined", conversation });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const getStudentChatMessages = async (req, res) => {
  if (!requireStudent(req, res)) return;
  if (!mongoose.isValidObjectId(req.params.conversationId)) return res.status(400).json({ message: "Invalid conversation" });
  try {
    const conversation = await StudentConversation.findOne({
      _id: req.params.conversationId,
      members: req.user._id,
      status: "accepted"
    }).populate("members", safeMemberFields);
    if (!conversation) return res.status(403).json({ message: "Only accepted members can open this student chat" });
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
    const [messages, total] = await Promise.all([
      Message.find({ conversation: conversation._id }).populate("sender", safeMemberFields)
        .sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      Message.countDocuments({ conversation: conversation._id })
    ]);
    return res.json({ conversation, messages: messages.reverse(), page, limit, total });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const sendStudentChatMessage = async (req, res) => {
  if (!requireStudent(req, res)) return;
  if (!mongoose.isValidObjectId(req.params.conversationId)) return res.status(400).json({ message: "Invalid conversation" });
  const message = typeof req.body.message === "string" ? req.body.message.trim() : "";
  const fileUrl = typeof req.body.fileUrl === "string" ? req.body.fileUrl : "";
  const mediaType = typeof req.body.mediaType === "string" ? req.body.mediaType : "";
  if (message.length > 2000) return res.status(400).json({ message: "Message must be 2000 characters or fewer" });
  if (!message && !fileUrl) return res.status(400).json({ message: "Write a message or attach an image / video" });
  if (containsBlockedChatLanguage(message)) return res.status(400).json({ message: "Please remove abusive or inappropriate language before sending this message." });
  if (containsPersonalContactDetails(message)) return res.status(400).json({ message: "For your privacy, phone numbers and email addresses cannot be shared in student chats." });
  if (fileUrl && !isTrustedCloudinaryMedia(fileUrl, mediaType)) return res.status(400).json({ message: "Only images and videos uploaded through GIG INDIA can be shared" });
  if (!fileUrl && mediaType) return res.status(400).json({ message: "Upload an image or video before sending it" });
  try {
    const conversation = await StudentConversation.findOne({
      _id: req.params.conversationId,
      members: req.user._id,
      status: "accepted"
    });
    if (!conversation) return res.status(403).json({ message: "Only accepted members can send messages in this student chat" });
    const receiver = conversation.members.find((member) => member.toString() !== req.user._id.toString());
    const saved = await Message.create({
      conversation: conversation._id,
      sender: req.user._id,
      receiver,
      message,
      fileUrl,
      mediaType
    });
    conversation.updatedAt = new Date();
    await conversation.save();
    await saved.populate("sender", safeMemberFields);
    req.app.get("io")?.to(`student-chat:${conversation._id}`).emit("studentChatMessage", saved);
    return res.status(201).json(saved);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = { searchStudents, requestStudentChat, listMyStudentChats, respondToStudentChat, getStudentChatMessages, sendStudentChatMessage };
