const mongoose = require("mongoose");
const User = require("../models/User");
const Gig = require("../models/Gig");
const Payment = require("../models/Payment");
const Review = require("../models/Review");
const Proposal = require("../models/Proposal");
const Message = require("../models/Message");
const StudentConversation = require("../models/StudentConversation");
const { releaseHeldPayment, refundPayment } = require("../utils/paymentService");
const { refreshUserRating } = require("../utils/reviewService");
const { getChatAccess } = require("../utils/chatAccess");
const { USERNAME_PATTERN, normalizeUsername, normalizeHttpUrl, normalizeSocialLinks } = require("../utils/profileFields");
const { cloudinary } = require("../config/cloudinary");

const pageOptions = (query) => {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 25));
  return { page, limit, skip: (page - 1) * limit };
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getDashboard = async (req, res) => {
  try {
    const [userCount, studentCount, clientCount, gigCount, disputedGigs, gigStatusStats, paymentStats] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: "student" }),
      User.countDocuments({ role: "client" }),
      Gig.countDocuments(),
      Gig.countDocuments({ status: "disputed" }),
      Gig.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      Payment.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 }, total: { $sum: "$totalAmount" } } }
      ])
    ]);
    return res.json({
      users: { total: userCount, students: studentCount, clients: clientCount },
      gigs: {
        total: gigCount,
        disputed: disputedGigs,
        byStatus: gigStatusStats.reduce((result, item) => {
          result[item._id] = item.count;
          return result;
        }, {})
      },
      payments: paymentStats.reduce((result, item) => {
        result[item._id] = { count: item.count, totalAmount: item.total };
        return result;
      }, {})
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const listUsers = async (req, res) => {
  try {
    const { page, limit, skip } = pageOptions(req.query);
    const filter = {};
    if (["student", "client", "admin"].includes(req.query.role)) filter.role = req.query.role;
    if (req.query.status === "suspended") Object.assign(filter, { isSuspended: true, isRemoved: { $ne: true } });
    if (req.query.status === "active") Object.assign(filter, { isSuspended: { $ne: true }, isRemoved: { $ne: true } });
    if (req.query.status === "removed") filter.isRemoved = true;
    if (typeof req.query.search === "string" && req.query.search.trim()) {
      const search = new RegExp(escapeRegex(req.query.search.trim().slice(0, 100)), "i");
      filter.$or = [{ name: search }, { email: search }, { college: search }, { username: search }, { whatsappNumber: search }];
    }
    const [users, total] = await Promise.all([
      User.find(filter).select("-password -resetPasswordToken -resetPasswordExpire")
        .sort({ createdAt: -1 }).skip(skip).limit(limit),
      User.countDocuments(filter)
    ]);
    return res.json({ users, page, limit, total });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const setUserSuspension = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.userId)) return res.status(400).json({ message: "Invalid user ID" });
    const { suspended } = req.body;
    if (typeof suspended !== "boolean") return res.status(400).json({ message: "suspended must be true or false" });
    if (req.params.userId === req.user._id.toString()) {
      return res.status(409).json({ message: "You cannot suspend your own admin account" });
    }
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.isRemoved) return res.status(409).json({ message: "This account has already been removed" });
    if (suspended && user.role === "admin" && !user.isSuspended) {
      const activeAdmins = await User.countDocuments({ role: "admin", isSuspended: { $ne: true }, isRemoved: { $ne: true } });
      if (activeAdmins <= 1) return res.status(409).json({ message: "The platform must keep at least one active admin" });
    }
    user.isSuspended = suspended;
    await user.save();
    if (suspended) req.app.get("io")?.in(`user:${user._id}`).disconnectSockets(true);
    return res.json({ message: suspended ? "User suspended" : "User reactivated", user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isSuspended: user.isSuspended
    } });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const updateUserProfile = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.userId)) return res.status(400).json({ message: "Invalid user ID" });
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.isRemoved) return res.status(409).json({ message: "Removed accounts cannot be edited" });
    const body = req.body || {};

    if (body.name !== undefined) {
      if (typeof body.name !== "string" || body.name.trim().length < 2 || body.name.trim().length > 120) return res.status(400).json({ message: "Name must be 2–120 characters" });
      user.name = body.name.trim();
    }
    if (body.email !== undefined) {
      if (typeof body.email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) return res.status(400).json({ message: "Enter a valid email address" });
      user.email = body.email.trim().toLowerCase();
    }
    if (body.username !== undefined) {
      const username = normalizeUsername(body.username);
      if (!USERNAME_PATTERN.test(username)) return res.status(400).json({ message: "Username must be 3–24 letters, numbers, _ or -" });
      user.username = username;
    }
    if (body.role !== undefined) {
      if (!["student", "client", "admin"].includes(body.role)) return res.status(400).json({ message: "Role must be student, client, or admin" });
      if (user._id.equals(req.user._id) && body.role !== "admin") return res.status(409).json({ message: "You cannot remove your own admin access" });
      if (user.role === "admin" && body.role !== "admin") {
        const activeAdmins = await User.countDocuments({ role: "admin", isSuspended: { $ne: true }, isRemoved: { $ne: true } });
        if (!user.isSuspended && activeAdmins <= 1) return res.status(409).json({ message: "The platform must keep at least one active admin" });
      }
      user.role = body.role;
    }
    if (body.college !== undefined) {
      if (typeof body.college !== "string" || body.college.trim().length > 160) return res.status(400).json({ message: "College / organization must be 160 characters or fewer" });
      user.college = body.college.trim();
    }
    if (body.companyName !== undefined) {
      if (typeof body.companyName !== "string" || body.companyName.trim().length > 160) return res.status(400).json({ message: "Company / organization must be 160 characters or fewer" });
      user.companyName = body.companyName.trim();
    }
    if (body.whatsappNumber !== undefined) {
      if (typeof body.whatsappNumber !== "string" || body.whatsappNumber.trim().length > 30) return res.status(400).json({ message: "WhatsApp number must be 30 characters or fewer" });
      user.whatsappNumber = body.whatsappNumber.trim();
    }
    if (body.bio !== undefined) {
      if (typeof body.bio !== "string" || body.bio.trim().length > 500) return res.status(400).json({ message: "About text must be 500 characters or fewer" });
      user.bio = body.bio.trim();
    }
    if (body.skills !== undefined) {
      if (!Array.isArray(body.skills) || body.skills.length > 20 || body.skills.some((skill) => typeof skill !== "string" || skill.trim().length > 40)) return res.status(400).json({ message: "Add up to 20 skills, each 40 characters or fewer" });
      user.skills = [...new Set(body.skills.map((skill) => skill.trim()).filter(Boolean))];
    }
    if (body.socialLinks !== undefined) {
      const result = normalizeSocialLinks(body.socialLinks);
      if (result.error) return res.status(400).json({ message: result.error });
      user.socialLinks = result.socialLinks;
    }
    if (body.portfolioLink !== undefined) {
      if (typeof body.portfolioLink !== "string" || body.portfolioLink.length > 2048) return res.status(400).json({ message: "Portfolio link must be 2048 characters or fewer" });
      const url = normalizeHttpUrl(body.portfolioLink);
      if (url === null) return res.status(400).json({ message: "Enter a valid portfolio URL" });
      user.portfolioLink = url;
    }
    if (body.profilePhoto !== undefined) {
      if (typeof body.profilePhoto !== "string" || body.profilePhoto.length > 2048) return res.status(400).json({ message: "Profile photo URL must be 2048 characters or fewer" });
      const url = normalizeHttpUrl(body.profilePhoto);
      if (url === null) return res.status(400).json({ message: "Enter a valid profile photo URL" });
      user.profilePhoto = url;
    }
    if (body.portfolio !== undefined) {
      if (!Array.isArray(body.portfolio) || body.portfolio.length > 30 || body.portfolio.some((url) => typeof url !== "string" || url.length > 2048 || normalizeHttpUrl(url) === null)) return res.status(400).json({ message: "Portfolio must contain up to 30 valid links" });
      user.portfolio = body.portfolio.map((url) => normalizeHttpUrl(url));
    }
    if (body.isVerified !== undefined) {
      if (typeof body.isVerified !== "boolean") return res.status(400).json({ message: "isVerified must be true or false" });
      user.isVerified = body.isVerified;
    }
    await user.save();
    return res.json({ message: "User profile updated", user: await User.findById(user._id).select("-password -resetPasswordToken -resetPasswordExpire") });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "That email or username is already in use" });
    return res.status(500).json({ message: error.message });
  }
};

const removeUser = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.userId)) return res.status(400).json({ message: "Invalid user ID" });
    if (req.params.userId === req.user._id.toString()) return res.status(409).json({ message: "You cannot remove the admin account you are currently using" });
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.isRemoved) return res.status(409).json({ message: "This account has already been removed" });
    if (user.role === "admin" && !user.isSuspended) {
      const activeAdmins = await User.countDocuments({ role: "admin", isSuspended: { $ne: true }, isRemoved: { $ne: true } });
      if (activeAdmins <= 1) return res.status(409).json({ message: "The platform must keep at least one active admin" });
    }

    const now = new Date();
    const id = user._id.toString();
    user.name = "Removed user";
    user.email = `removed-${id}@deleted.gigindia.invalid`;
    user.username = undefined;
    user.college = "";
    user.companyName = "";
    user.skills = [];
    user.bio = "";
    user.socialLinks = { github: "", linkedin: "", instagram: "", discord: "" };
    user.portfolioLink = "";
    user.profilePhoto = "";
    user.portfolio = [];
    user.whatsappNumber = "";
    user.isVerified = false;
    user.isSuspended = true;
    user.isRemoved = true;
    user.removedAt = now;
    await user.save();
    req.app.get("io")?.in(`user:${user._id}`).disconnectSockets(true);
    return res.json({ message: "Account removed and personal profile details anonymized. Gig and payment records were preserved.", userId: user._id });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const setRazorpayAccount = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.userId)) return res.status(400).json({ message: "Invalid user ID" });
    const { razorpayAccountId } = req.body;
    if (typeof razorpayAccountId !== "string" || !/^acc_[A-Za-z0-9]+$/.test(razorpayAccountId.trim())) {
      return res.status(400).json({ message: "Provide the student's Razorpay Route linked-account ID (acc_...)" });
    }
    const user = await User.findOneAndUpdate(
      { _id: req.params.userId, role: "student" },
      { $set: { razorpayAccountId: razorpayAccountId.trim() } },
      { new: true }
    ).select("name email role razorpayAccountId");
    if (!user) return res.status(404).json({ message: "Student not found" });
    return res.json({ message: "Razorpay Route linked-account ID saved", user });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const listGigs = async (req, res) => {
  try {
    const validStatuses = ["open", "in-progress", "submitted", "pending-admin-approval", "payout-processing", "completed", "disputed", "cancelled"];
    const { page, limit, skip } = pageOptions(req.query);
    const filter = {};
    if (req.query.status === "removed") filter.isRemoved = true;
    else if (validStatuses.includes(req.query.status)) Object.assign(filter, { status: req.query.status, isRemoved: { $ne: true } });
    if (typeof req.query.search === "string" && req.query.search.trim()) {
      filter.title = new RegExp(escapeRegex(req.query.search.trim().slice(0, 100)), "i");
    }
    const [gigs, total] = await Promise.all([
      Gig.find(filter).populate("client", "name email companyName").populate("assignedTo", "name email")
        .sort({ createdAt: -1 }).skip(skip).limit(limit),
      Gig.countDocuments(filter)
    ]);
    const gigIds = gigs.map((gig) => gig._id);
    const [proposals, payments, messageCounts, reviewCounts] = gigIds.length ? await Promise.all([
      Proposal.find({ gig: { $in: gigIds } })
        .select("gig student proposedAmount deliveryDays status createdAt unappliedAt")
        .populate("student", "name email")
        .sort({ createdAt: -1 }),
      Payment.find({ gig: { $in: gigIds } })
        .select("gig status mode totalAmount platformFee studentAmount createdAt clientClosedAt releasedAt refundedAt")
        .sort({ createdAt: -1 }),
      Message.aggregate([
        { $match: { gig: { $in: gigIds } } },
        { $group: { _id: "$gig", count: { $sum: 1 } } }
      ]),
      Review.aggregate([
        { $match: { gig: { $in: gigIds } } },
        { $group: { _id: "$gig", count: { $sum: 1 } } }
      ])
    ]) : [[], [], [], []];

    const proposalSummaries = new Map();
    for (const proposal of proposals) {
      const key = proposal.gig.toString();
      if (!proposalSummaries.has(key)) {
        proposalSummaries.set(key, { total: 0, pending: 0, accepted: 0, rejected: 0, withdrawn: 0, latest: [] });
      }
      const summary = proposalSummaries.get(key);
      summary.total += 1;
      summary[proposal.status] += 1;
      if (summary.latest.length < 3) summary.latest.push(proposal);
    }
    const paymentByGig = new Map();
    const paymentCounts = new Map();
    for (const payment of payments) {
      const key = payment.gig.toString();
      paymentCounts.set(key, (paymentCounts.get(key) || 0) + 1);
      if (!paymentByGig.has(key)) paymentByGig.set(key, payment);
    }
    const messageCountsByGig = new Map(messageCounts.map((item) => [item._id.toString(), item.count]));
    const reviewCountsByGig = new Map(reviewCounts.map((item) => [item._id.toString(), item.count]));

    return res.json({
      gigs: gigs.map((gig) => ({
        ...gig.toObject(),
        chatAccess: getChatAccess(gig),
        proposalSummary: proposalSummaries.get(gig._id.toString()) || {
          total: 0, pending: 0, accepted: 0, rejected: 0, withdrawn: 0, latest: []
        },
        payment: paymentByGig.get(gig._id.toString()) || null,
        paymentCount: paymentCounts.get(gig._id.toString()) || 0,
        messageCount: messageCountsByGig.get(gig._id.toString()) || 0,
        reviewCount: reviewCountsByGig.get(gig._id.toString()) || 0
      })),
      page,
      limit,
      total
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const setGigRemoval = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.gigId)) return res.status(400).json({ message: "Invalid gig ID" });
    if (typeof req.body.removed !== "boolean") return res.status(400).json({ message: "removed must be true or false" });
    const gig = await Gig.findById(req.params.gigId);
    if (!gig) return res.status(404).json({ message: "Gig not found" });
    gig.isRemoved = req.body.removed;
    gig.removedAt = req.body.removed ? new Date() : null;
    gig.removedBy = req.body.removed ? req.user._id : null;
    await gig.save();

    let paymentHoldPlaced = false;
    if (req.body.removed) {
      const now = new Date();
      const payment = await Payment.findOneAndUpdate(
        { gig: gig._id, status: { $in: ["paid", "escrowed", "disputed"] }, adminHold: { $ne: true } },
        { $set: {
          adminHold: true,
          adminHoldReason: "Gig hidden by an admin; review before releasing funds",
          adminHeldBy: req.user._id,
          adminHeldAt: now,
          adminHoldClearedAt: null
        } },
        { new: true }
      );
      paymentHoldPlaced = Boolean(payment);
    }
    return res.json({
      message: req.body.removed
        ? "Gig removed from public listings. Its history remains available to members and admins."
        : "Gig restored to its previous listing state.",
      gig,
      paymentHoldPlaced
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const deleteGigAdmin = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.gigId)) return res.status(400).json({ message: "Invalid gig ID" });
    const gig = await Gig.findById(req.params.gigId);
    if (!gig) return res.status(404).json({ message: "Gig not found" });

    if (!(["open", "cancelled"].includes(gig.status)) || gig.assignedTo || gig.paymentStatus !== "pending" || gig.razorpayOrderId) {
      return res.status(409).json({ message: "This gig has work or payment activity. Remove it from public listings to preserve its history." });
    }

    const [proposalCount, paymentCount, messageCount, reviewCount] = await Promise.all([
      Proposal.countDocuments({ gig: gig._id }),
      Payment.countDocuments({ gig: gig._id }),
      Message.countDocuments({ gig: gig._id }),
      Review.countDocuments({ gig: gig._id })
    ]);
    if (proposalCount || paymentCount || messageCount || reviewCount) {
      return res.status(409).json({ message: "This gig has application, chat, review, or payment history. Remove it from public listings to preserve those records." });
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const attachmentIds = (gig.attachments || []).map((url) => {
      const prefix = `https://res.cloudinary.com/${cloudName}/image/upload/`;
      if (!cloudName || typeof url !== "string" || !url.startsWith(prefix)) return null;
      const match = url.slice(prefix.length).match(/(?:^|\/)v\d+\/(gigindia\/gigs\/[^?#]+)/);
      return match ? match[1].replace(/\.[a-z0-9]+$/i, "") : null;
    });
    if (attachmentIds.some((publicId) => !publicId)) {
      return res.status(409).json({ message: "A gig image could not be safely identified for cleanup. Remove the listing to preserve its data." });
    }

    const deletedGig = await Gig.findOneAndDelete({
      _id: gig._id,
      status: { $in: ["open", "cancelled"] },
      assignedTo: null,
      paymentStatus: "pending",
      razorpayOrderId: { $in: ["", null] }
    });
    if (!deletedGig) return res.status(409).json({ message: "This gig changed while it was being deleted. Refresh the page and try again." });

    const cleanupResults = await Promise.allSettled(attachmentIds.map((publicId) => cloudinary.uploader.destroy(publicId, { resource_type: "image" })));
    const cleanupFailed = cleanupResults.some((result) => result.status === "rejected");
    return res.json({
      message: cleanupFailed
        ? "Gig permanently deleted. An uploaded image could not be removed from storage."
        : "Gig permanently deleted.",
      mediaCleanupPending: cleanupFailed
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const getUserHistory = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.userId)) return res.status(400).json({ message: "Invalid user ID" });
    const user = await User.findById(req.params.userId).select("_id name username role createdAt isRemoved");
    if (!user) return res.status(404).json({ message: "User not found" });
    const [postedGigs, proposals, assignedGigs, payments] = await Promise.all([
      Gig.find({ client: user._id }).select("title status paymentStatus budget createdAt completedAt closedAt isRemoved").sort({ createdAt: -1 }).limit(100),
      Proposal.find({ student: user._id }).select("gig status proposedAmount deliveryDays createdAt unappliedAt")
        .populate({ path: "gig", select: "title status paymentStatus client createdAt completedAt closedAt isRemoved", populate: { path: "client", select: "name username" } })
        .sort({ createdAt: -1 }).limit(100),
      Gig.find({ assignedTo: user._id }).select("title status paymentStatus budget client createdAt completedAt closedAt isRemoved")
        .populate("client", "name username").sort({ updatedAt: -1 }).limit(100),
      Payment.find({ $or: [{ client: user._id }, { student: user._id }] }).select("gig status mode totalAmount platformFee studentAmount createdAt releasedAt refundedAt")
        .populate("gig", "title status").sort({ createdAt: -1 }).limit(100)
    ]);
    return res.json({ user, postedGigs, proposals, assignedGigs, payments });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const listStudentChats = async (req, res) => {
  try {
    const { page, limit, skip } = pageOptions(req.query);
    const filter = {};
    if (["pending", "accepted", "rejected", "blocked"].includes(req.query.status)) filter.status = req.query.status;
    const [conversations, total] = await Promise.all([
      StudentConversation.find(filter).populate("members", "name username role isSuspended isRemoved")
        .populate("requester recipient", "name username role")
        .sort({ updatedAt: -1 }).skip(skip).limit(limit),
      StudentConversation.countDocuments(filter)
    ]);
    return res.json({ conversations, page, limit, total });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const setStudentChatStatus = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.conversationId)) return res.status(400).json({ message: "Invalid conversation ID" });
    if (!["accepted", "rejected", "blocked"].includes(req.body.status)) return res.status(400).json({ message: "Choose accepted, rejected, or blocked" });
    const conversation = await StudentConversation.findByIdAndUpdate(req.params.conversationId, {
      $set: { status: req.body.status, statusChangedAt: new Date(), statusChangedBy: req.user._id }
    }, { new: true }).populate("members", "name username role");
    if (!conversation) return res.status(404).json({ message: "Student chat not found" });
    if (req.body.status !== "accepted") req.app.get("io")?.in(`student-chat:${conversation._id}`).disconnectSockets(true);
    for (const memberId of conversation.members) req.app.get("io")?.to(`user:${memberId}`).emit("studentChatStatus");
    return res.json({ message: `Student chat ${req.body.status} by admin`, conversation });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const getStudentChatMessages = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.conversationId)) return res.status(400).json({ message: "Invalid conversation ID" });
    const conversation = await StudentConversation.findById(req.params.conversationId).populate("members", "name username role");
    if (!conversation) return res.status(404).json({ message: "Student chat not found" });
    const { page, limit, skip } = pageOptions({ ...req.query, limit: req.query.limit || 50 });
    const [messages, total] = await Promise.all([
      Message.find({ conversation: conversation._id }).populate("sender", "name username role isRemoved")
        .sort({ createdAt: -1 }).skip(skip).limit(limit),
      Message.countDocuments({ conversation: conversation._id })
    ]);
    return res.json({ conversation, messages: messages.reverse(), page, limit, total });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const listProposals = async (req, res) => {
  try {
    const { page, limit, skip } = pageOptions(req.query);
    const filter = {};
    if (["pending", "accepted", "rejected", "withdrawn"].includes(req.query.status)) filter.status = req.query.status;
    if (mongoose.isValidObjectId(req.query.gigId)) filter.gig = req.query.gigId;
    if (mongoose.isValidObjectId(req.query.studentId)) filter.student = req.query.studentId;
    const [proposals, total] = await Promise.all([
      Proposal.find(filter)
        .select("gig student coverLetter proposedAmount deliveryDays status createdAt unappliedAt")
        .populate({
          path: "gig",
          select: "title status paymentStatus client assignedTo",
          populate: { path: "client", select: "name email" }
        })
        .populate({ path: "student", select: "name email college" })
        .sort({ createdAt: -1 }).skip(skip).limit(limit),
      Proposal.countDocuments(filter)
    ]);
    return res.json({ proposals, page, limit, total });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const listPayments = async (req, res) => {
  try {
    const validStatuses = ["created", "paid", "escrowed", "releasing", "refunding", "released", "refunded", "disputed"];
    const { page, limit, skip } = pageOptions(req.query);
    const filter = {};
    if (validStatuses.includes(req.query.status)) filter.status = req.query.status;
    const [payments, total] = await Promise.all([
      Payment.find(filter)
        .populate("gig", "title status paymentStatus clientClosedAt submissionLink submissionNote")
        .populate("client", "name email")
        .populate("student", "name email razorpayAccountId")
        .sort({ createdAt: -1 }).skip(skip).limit(limit),
      Payment.countDocuments(filter)
    ]);
    return res.json({ payments, page, limit, total });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const listReviews = async (req, res) => {
  try {
    const { page, limit, skip } = pageOptions(req.query);
    const filter = {};
    if (mongoose.isValidObjectId(req.query.userId)) filter.reviewee = req.query.userId;
    if (mongoose.isValidObjectId(req.query.gigId)) filter.gig = req.query.gigId;
    const [reviews, total] = await Promise.all([
      Review.find(filter)
        .populate("reviewer", "name email")
        .populate("reviewee", "name email rating totalReviews")
        .populate("gig", "title")
        .sort({ createdAt: -1 }).skip(skip).limit(limit),
      Review.countDocuments(filter)
    ]);
    return res.json({ reviews, page, limit, total });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const listDisputes = async (req, res) => {
  try {
    const payments = await Payment.find({ status: "disputed" })
      .populate({ path: "gig", select: "title status disputeReason disputedAt client assignedTo" })
      .populate("client", "name email")
      .populate("student", "name email")
      .sort({ updatedAt: 1 });
    return res.json({ disputes: payments });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const getGigChatMessages = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.gigId)) return res.status(400).json({ message: "Invalid gig ID" });
    const gig = await Gig.findById(req.params.gigId).select("title status client assignedTo closedAt completedAt");
    if (!gig) return res.status(404).json({ message: "Gig not found" });
    const { page, limit, skip } = pageOptions({ ...req.query, limit: req.query.limit || 50 });
    const [messages, total] = await Promise.all([
      Message.find({ gig: gig._id }).populate("sender", "name profilePhoto role isRemoved")
        .sort({ createdAt: -1 }).skip(skip).limit(limit),
      Message.countDocuments({ gig: gig._id })
    ]);
    return res.json({ gig, messages: messages.reverse(), page, limit, total, chatAccess: getChatAccess(gig) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const setPaymentAdminHold = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.paymentId)) return res.status(400).json({ message: "Invalid payment ID" });
    const { held, reason = "" } = req.body;
    if (typeof held !== "boolean") return res.status(400).json({ message: "held must be true or false" });
    if (typeof reason !== "string" || reason.trim().length > 500) return res.status(400).json({ message: "Hold reason must be 500 characters or fewer" });
    if (held && !reason.trim()) return res.status(400).json({ message: "Add a reason before placing a payment hold" });
    const payment = await Payment.findById(req.params.paymentId);
    if (!payment) return res.status(404).json({ message: "Payment not found" });
    if (!["paid", "escrowed", "disputed"].includes(payment.status)) return res.status(409).json({ message: "Only captured, escrowed, or disputed payments can be held" });
    const now = new Date();
    const update = { $set: { adminHold: held } };
    if (held) {
      Object.assign(update.$set, { adminHoldReason: reason.trim(), adminHeldBy: req.user._id, adminHeldAt: now, adminHoldClearedAt: null });
    } else if (payment.adminHold) {
      update.$set.adminHoldClearedAt = now;
    }
    const updatedPayment = await Payment.findOneAndUpdate(
      { _id: payment._id, status: { $in: ["paid", "escrowed", "disputed"] } },
      update,
      { new: true }
    );
    if (!updatedPayment) return res.status(409).json({ message: "Payment status changed. Refresh and try again." });
    return res.json({ message: held ? "Admin hold placed. Payout approval is paused." : "Admin hold cleared. Payout can be approved after client closure.", payment: updatedPayment });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const approvePaymentPayout = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.paymentId)) return res.status(400).json({ message: "Invalid payment ID" });
    const payment = await Payment.findById(req.params.paymentId);
    if (!payment) return res.status(404).json({ message: "Payment not found" });
    const gig = await Gig.findById(payment.gig).select("title status paymentStatus clientClosedAt");
    if (!gig) return res.status(404).json({ message: "The gig linked to this payment was not found" });
    if (gig.status !== "pending-admin-approval" || !payment.clientClosedAt) {
      return res.status(409).json({ message: "The client must close the project before admin payout approval" });
    }
    if (!["paid", "escrowed"].includes(payment.status)) {
      return res.status(409).json({ message: `This payment cannot be approved while it is ${payment.status}` });
    }
    if (payment.adminHold) return res.status(409).json({ message: "Clear the admin hold before approving this payout" });

    const result = await releaseHeldPayment(payment._id);
    return res.json({
      mode: result.payment.mode || "live",
      status: result.payment.status,
      payoutPending: Boolean(result.payoutPending),
      message: result.payoutPending
        ? "Payout approval accepted. Razorpay is processing the transfer; the project will move to completed when it confirms processing."
        : result.alreadyReleased
          ? "This payout was already processed"
          : result.payment.mode === "test"
            ? "Test payout recorded; no real money moved"
            : "Razorpay confirmed the transfer was processed",
      studentAmount: result.payment.studentAmount,
      platformFee: result.payment.platformFee
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : "Payout approval could not be processed. Refresh and review the payment record." });
  }
};

const resolveDispute = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.gigId)) return res.status(400).json({ message: "Invalid gig ID" });
    const { resolution, note = "" } = req.body;
    if (!["release", "refund"].includes(resolution)) {
      return res.status(400).json({ message: "resolution must be 'release' or 'refund'" });
    }
    if (typeof note !== "string" || note.trim().length > 2000) {
      return res.status(400).json({ message: "Resolution note must be 2000 characters or fewer" });
    }
    const gig = await Gig.findById(req.params.gigId);
    if (!gig) return res.status(404).json({ message: "Gig not found" });
    const payment = await Payment.findOne({ gig: gig._id, status: "disputed" });
    if (!payment || gig.status !== "disputed") {
      return res.status(409).json({ message: "No open dispute exists for this gig" });
    }

    let result;
    if (resolution === "release") {
      result = await releaseHeldPayment(payment._id, { allowDisputed: true, overrideAdminHold: true });
    } else {
      result = await refundPayment(payment._id, {
        allowedStatuses: ["disputed"],
        reason: note.trim() || "GIG INDIA admin dispute resolution"
      });
    }

    await Gig.findByIdAndUpdate(gig._id, {
      $set: {
        disputeResolution: resolution,
        disputeResolutionNote: note.trim()
      }
    });
    return res.json({
      message: resolution === "release"
        ? result.payment.mode === "test" ? "Test dispute resolved; payout release simulated, no real money moved" : "Dispute resolved; held Route transfer released"
        : "Dispute resolved; customer refund requested",
      resolution,
      payment: result.payment
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.statusCode ? error.message : "Dispute resolution failed. Check the payment provider and retry."
    });
  }
};

const refundPaymentAdmin = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.gigId)) return res.status(400).json({ message: "Invalid gig ID" });
    const { reason } = req.body;
    if (typeof reason !== "string" || !reason.trim() || reason.trim().length > 200) {
      return res.status(400).json({ message: "A refund reason of 1–200 characters is required" });
    }
    const payment = await Payment.findOne({ gig: req.params.gigId, status: { $in: ["paid", "escrowed"] } });
    if (!payment) return res.status(404).json({ message: "No paid or held payment was found for this gig" });
    const result = await refundPayment(payment._id, {
      allowedStatuses: ["paid", "escrowed"],
      reason: reason.trim()
    });
    return res.json({ message: "Customer refund requested through Razorpay", payment: result.payment });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.statusCode ? error.message : "Refund failed. Check Razorpay and retry."
    });
  }
};

const deleteReview = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.reviewId)) return res.status(400).json({ message: "Invalid review ID" });
    const review = await Review.findByIdAndDelete(req.params.reviewId);
    if (!review) return res.status(404).json({ message: "Review not found" });
    await refreshUserRating(review.reviewee);
    return res.json({ message: "Review removed and user rating recalculated" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
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
};
