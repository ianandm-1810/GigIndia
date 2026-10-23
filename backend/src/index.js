require("dotenv").config();
const http = require("http");
const { Server } = require("socket.io");
const app = require("./app");
const connectDB = require("./config/db");
const jwt = require("jsonwebtoken");
const User = require("./models/User");
const Gig = require("./models/Gig");
const Message = require("./models/Message");
const StudentConversation = require("./models/StudentConversation");
const { processPaymentMaintenance } = require("./utils/paymentService");
const { getChatAccess } = require("./utils/chatAccess");
const { containsBlockedChatLanguage, containsPersonalContactDetails } = require("./utils/chatModeration");

const PORT = process.env.PORT || 5000;

// HTTP server banana — Socket.io ke liye
const server = http.createServer(app);

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});
app.set("io", io);
// Socket login check — bina valid token ke connect nahi hoga
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error("Not authorized, no token"));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");

    if (!user || user.isRemoved) {
      return next(new Error("User not found"));
    }

    if (user.isSuspended) {
      return next(new Error("This account is suspended"));
    }

    socket.user = user;
    next();
  } catch (error) {
    next(new Error("Not authorized, token failed"));
  }
});

// Helper: check karo ki user is gig ke chat ka hissa hai ya nahi
const getChatGig = async (gigId, userId) => {
  const activeUser = await User.findById(userId).select("isSuspended isRemoved");
  if (!activeUser || activeUser.isRemoved || activeUser.isSuspended) return null;
  const gig = await Gig.findById(gigId);
  if (!gig) return null;

  const isClient = gig.client.toString() === userId.toString();
  const isStudent = gig.assignedTo && gig.assignedTo.toString() === userId.toString();

  if (!isClient && !isStudent) return null;
  const chatAccess = getChatAccess(gig);
  return { gig, isClient, chatAccess };
};

// Socket.io logic
io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);
  socket.join(`user:${socket.user._id}`);

  // Gig room join — sirf client ya assigned student
  socket.on("joinRoom", async (gigId, acknowledge) => {
    const reply = (result) => {
      if (typeof acknowledge !== "function") return false;
      acknowledge(result);
      return true;
    };
    try {
      const result = await getChatGig(gigId, socket.user._id);
      if (!result) {
        if (!reply({ ok: false, message: "Is gig ke chat mein aapko access nahi hai" })) {
          socket.emit("errorMessage", "Is gig ke chat mein aapko access nahi hai");
        }
        return;
      }
      if (!result.chatAccess.available) {
        const message = "This project chat closed 15 days after the gig was closed";
        if (!reply({ ok: false, message, chatAccessUntil: result.chatAccess.expiresAt })) socket.emit("errorMessage", message);
        return;
      }
      socket.join(String(gigId));
      reply({ ok: true, chatAccess: result.chatAccess });
      console.log(`User ${socket.user._id} joined room: ${gigId}`);
    } catch (error) {
      if (!reply({ ok: false, message: "Room join nahi ho paya" })) {
        socket.emit("errorMessage", "Room join nahi ho paya");
      }
    }
  });

  // Message bhejo — DB mein save karo, phir room mein bhejo
  socket.on("sendMessage", async (data, acknowledge) => {
    const reply = (result) => {
      if (typeof acknowledge !== "function") return false;
      acknowledge(result);
      return true;
    };
    try {
      const { gigId, message = "", fileUrl = "", mediaType = "" } = data || {};
      if (typeof message !== "string") {
        if (!reply({ ok: false, message: "Message must be plain text" })) socket.emit("errorMessage", "Message must be plain text");
        return;
      }
      const trimmedMessage = message.trim();

      if (!trimmedMessage && !fileUrl) {
        if (!reply({ ok: false, message: "Message khaali hai" })) socket.emit("errorMessage", "Message khaali hai");
        return;
      }
      if (trimmedMessage.length > 2000) {
        if (!reply({ ok: false, message: "Message bahut lamba hai" })) socket.emit("errorMessage", "Message bahut lamba hai");
        return;
      }
      if (containsBlockedChatLanguage(trimmedMessage)) {
        const moderationMessage = "Please remove abusive or inappropriate language before sending this message.";
        if (!reply({ ok: false, message: moderationMessage })) socket.emit("errorMessage", moderationMessage);
        return;
      }
      if (containsPersonalContactDetails(trimmedMessage)) {
        const privacyMessage = "For your privacy, phone numbers and email addresses cannot be shared in chat.";
        if (!reply({ ok: false, message: privacyMessage })) socket.emit("errorMessage", privacyMessage);
        return;
      }
      if (fileUrl && !["image", "video"].includes(mediaType)) {
        if (!reply({ ok: false, message: "Only uploaded images or videos can be shared here" })) socket.emit("errorMessage", "Only uploaded images or videos can be shared here");
        return;
      }
      if (!fileUrl && mediaType) {
        if (!reply({ ok: false, message: "Upload an image or video before sending it" })) socket.emit("errorMessage", "Upload an image or video before sending it");
        return;
      }
      if (fileUrl) {
        const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
        const expectedPrefix = `https://res.cloudinary.com/${cloudName}/${mediaType}/upload/`;
        if (!cloudName || !fileUrl.startsWith(expectedPrefix)) {
          if (!reply({ ok: false, message: "This media link was not uploaded through GIG INDIA" })) socket.emit("errorMessage", "This media link was not uploaded through GIG INDIA");
          return;
        }
      }

      const result = await getChatGig(gigId, socket.user._id);
      if (!result) {
        if (!reply({ ok: false, message: "Is gig ke chat mein aapko access nahi hai" })) {
          socket.emit("errorMessage", "Is gig ke chat mein aapko access nahi hai");
        }
        return;
      }

      const { gig, isClient, chatAccess } = result;

      if (!socket.rooms.has(String(gigId))) {
        if (!reply({ ok: false, message: "Join this project chat before sending a message" })) {
          socket.emit("errorMessage", "Join this project chat before sending a message");
        }
        return;
      }
      if (!chatAccess.available) {
        if (!reply({ ok: false, message: "This project chat closed 15 days after the gig was closed", chatAccessUntil: chatAccess.expiresAt })) {
          socket.emit("errorMessage", "This project chat closed 15 days after the gig was closed");
        }
        return;
      }

      if (!gig.assignedTo) {
        if (!reply({ ok: false, message: "Gig abhi kisi student ko assign nahi hua" })) {
          socket.emit("errorMessage", "Gig abhi kisi student ko assign nahi hua");
        }
        return;
      }

      // Receiver wo hai jo sender nahi hai
      const receiverId = isClient ? gig.assignedTo : gig.client;

      const saved = await Message.create({
        gig: gig._id,
        sender: socket.user._id,
        receiver: receiverId,
        message: trimmedMessage,
        fileUrl,
        mediaType
      });

      io.to(String(gigId)).emit("receiveMessage", saved);
      reply({ ok: true });
    } catch (error) {
      if (!reply({ ok: false, message: "Message bhej nahi paye" })) {
        socket.emit("errorMessage", "Message bhej nahi paye");
      }
    }
  });

  socket.on("joinStudentChat", async (conversationId, acknowledge) => {
    const reply = (result) => {
      if (typeof acknowledge !== "function") return false;
      acknowledge(result);
      return true;
    };
    try {
      if (socket.user.role !== "student") return reply({ ok: false, message: "Student accounts only" });
      const activeUser = await User.findById(socket.user._id).select("isSuspended isRemoved role");
      const conversation = await StudentConversation.findOne({
        _id: conversationId,
        members: socket.user._id,
        status: "accepted"
      });
      if (!activeUser || activeUser.role !== "student" || activeUser.isSuspended || activeUser.isRemoved || !conversation) {
        return reply({ ok: false, message: "This accepted student chat is not available to your account" });
      }
      socket.join(`student-chat:${conversation._id}`);
      return reply({ ok: true });
    } catch (error) {
      return reply({ ok: false, message: "Could not open this student chat" });
    }
  });

  // Typing indicator — sirf tab jab user us room mein ho
  socket.on("typing", async (data) => {
    const gigId = String(data?.gigId);
    if (!socket.rooms.has(gigId)) return;
    try {
      const result = await getChatGig(gigId, socket.user._id);
      if (result?.chatAccess.available) {
        socket.to(gigId).emit("userTyping", { gigId, userId: socket.user._id });
      }
    } catch (error) {
      // Ignore typing updates if the gig no longer exists or access has expired.
    }
  });

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

// Connect DB then start server
connectDB().then(() => {
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT} 🚀`);
  });
  // Recover interrupted refunds and refresh the status of admin-approved payouts.
  processPaymentMaintenance().catch((error) => {
    console.error(`Payment maintenance failed: ${error.message}`);
  });
  const paymentMaintenanceTimer = setInterval(() => {
    processPaymentMaintenance().catch((error) => {
      console.error(`Payment maintenance failed: ${error.message}`);
    });
  }, 60 * 1000);
  paymentMaintenanceTimer.unref();
}).catch((error) => {
  console.error(`Database connection failed: ${error.message}`);
  process.exit(1);
});
