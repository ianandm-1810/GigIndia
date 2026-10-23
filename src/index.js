require("dotenv").config();
const http = require("http");
const { Server } = require("socket.io");
const app = require("./app");
const connectDB = require("./config/db");
const jwt = require("jsonwebtoken");
const User = require("./models/User");
const Gig = require("./models/Gig");
const Message = require("./models/Message");

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
// Socket login check — bina valid token ke connect nahi hoga
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error("Not authorized, no token"));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return next(new Error("User not found"));
    }

    socket.user = user;
    next();
  } catch (error) {
    next(new Error("Not authorized, token failed"));
  }
});

// Helper: check karo ki user is gig ke chat ka hissa hai ya nahi
const getChatGig = async (gigId, userId) => {
  const gig = await Gig.findById(gigId);
  if (!gig) return null;

  const isClient = gig.client.toString() === userId.toString();
  const isStudent = gig.assignedTo && gig.assignedTo.toString() === userId.toString();

  if (!isClient && !isStudent) return null;
  return { gig, isClient };
};

// Socket.io logic
io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Gig room join — sirf client ya assigned student
  socket.on("joinRoom", async (gigId) => {
    try {
      const result = await getChatGig(gigId, socket.user._id);
      if (!result) {
        return socket.emit("errorMessage", "Is gig ke chat mein aapko access nahi hai");
      }
      socket.join(String(gigId));
      console.log(`User ${socket.user._id} joined room: ${gigId}`);
    } catch (error) {
      socket.emit("errorMessage", "Room join nahi ho paya");
    }
  });

  // Message bhejo — DB mein save karo, phir room mein bhejo
  socket.on("sendMessage", async (data) => {
    try {
      const { gigId, message, fileUrl } = data || {};

      if (!message?.trim() && !fileUrl) {
        return socket.emit("errorMessage", "Message khaali hai");
      }
      if (message && message.length > 2000) {
        return socket.emit("errorMessage", "Message bahut lamba hai");
      }

      const result = await getChatGig(gigId, socket.user._id);
      if (!result) {
        return socket.emit("errorMessage", "Is gig ke chat mein aapko access nahi hai");
      }

      const { gig, isClient } = result;

      if (!gig.assignedTo) {
        return socket.emit("errorMessage", "Gig abhi kisi student ko assign nahi hua");
      }

      // Receiver wo hai jo sender nahi hai
      const receiverId = isClient ? gig.assignedTo : gig.client;

      const saved = await Message.create({
        gig: gig._id,
        sender: socket.user._id,
        receiver: receiverId,
        message: message ? message.trim() : "",
        fileUrl: fileUrl || ""
      });

      io.to(String(gigId)).emit("receiveMessage", saved);
    } catch (error) {
      socket.emit("errorMessage", "Message bhej nahi paye");
    }
  });

  // Typing indicator — sirf tab jab user us room mein ho
  socket.on("typing", (data) => {
    const gigId = String(data?.gigId);
    if (socket.rooms.has(gigId)) {
      socket.to(gigId).emit("userTyping", { gigId, userId: socket.user._id });
    }
  });

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

// Connect DB then start server
connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT} 🚀`);
  });
});