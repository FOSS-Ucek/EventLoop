require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const { PrismaClient } = require("@prisma/client");

const app = express();
const server = http.createServer(app);

// Initialize Prisma Client
const prisma = new PrismaClient();

// Configure CORS to allow frontend communication
const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
app.use(
  cors({
    origin: frontendUrl,
    credentials: true,
  })
);

app.use(express.json({ limit: "5mb" })); // Support larger Base64 photo uploads

// Set up Socket.io connection (from package.json requirements)
const io = new Server(server, {
  cors: {
    origin: frontendUrl,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

io.on("connection", (socket) => {
  console.log(`📡 Socket connected: ${socket.id}`);

  socket.on("disconnect", () => {
    console.log(`🔌 Socket disconnected: ${socket.id}`);
  });
});

// =========================================================================
// Express API Endpoints for Prisma & MongoDB
// =========================================================================

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "healthy", database: "mongodb + prisma" });
});

// Helper to validate MongoDB 24-hex-char ObjectId strings
const isValidObjectId = (id) => typeof id === "string" && /^[0-9a-fA-F]{24}$/.test(id);

// 1. Get All Users (Admin Panel)
app.get("/api/users", async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, users });
  } catch (error) {
    console.error("❌ Get users error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch users from database" });
  }
});

// 2. Get Single User (by ID or Email)
app.get("/api/user", async (req, res) => {
  const { id, email } = req.query;

  try {
    let user = null;
    if (id && isValidObjectId(id)) {
      user = await prisma.user.findUnique({ where: { id } });
    }
    if (!user && email) {
      user = await prisma.user.findUnique({ where: { email } });
    }

    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    res.json({ success: true, user });
  } catch (error) {
    console.error("❌ Get user error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch user record" });
  }
});

// 3. Sync / Upsert Google User (NextAuth callback hook)
app.post("/api/user/upsert", async (req, res) => {
  const { email, name, image } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, error: "Email is required" });
  }

  try {
    // 1. Check if user already exists
    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      // 2. Register new user (default role is 'user')
      user = await prisma.user.create({
        data: {
          email,
          name,
          image,
          role: "user",
        },
      });
      console.log(`🆕 Registered new user: ${email}`);
    } else {
      console.log(`✅ Logged in existing user: ${email}`);
    }

    res.json({ success: true, user });
  } catch (error) {
    console.error("❌ Upsert user error:", error);
    res.status(500).json({ success: false, error: "Internal Database Sync Error" });
  }
});

// 4. Update User Profile Settings (Name, Base64 Image, and Testing Roles)
app.post("/api/user/update", async (req, res) => {
  const { id, email, name, image, role } = req.body;

  if (!id && !email) {
    return res.status(400).json({ success: false, error: "User ID ('id') or 'email' is required" });
  }

  try {
    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (image !== undefined) updateData.image = image;
    if (role !== undefined && (role === "admin" || role === "user")) {
      updateData.role = role;
    }

    const whereClause = (id && isValidObjectId(id)) ? { id } : (email ? { email } : null);

    if (!whereClause) {
      return res.status(400).json({ success: false, error: "Valid MongoDB ObjectId or Email is required" });
    }

    const updatedUser = await prisma.user.update({
      where: whereClause,
      data: updateData,
    });

    console.log(`✏️ Updated profile for user:`, whereClause);
    res.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error("❌ Update user error:", error);
    res.status(500).json({ success: false, error: "Failed to update user profile in database" });
  }
});

// Start the Server
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚀 Express Backend server running on port ${PORT}`);
});
