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

// =========================================================================
// Event Endpoints
// =========================================================================

// 5. Get All Events (Includes participant counts)
app.get("/api/events", async (req, res) => {
  try {
    const events = await prisma.event.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
        },
      },
    });
    res.json({ success: true, events });
  } catch (error) {
    console.error("❌ Get events error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch events" });
  }
});

// 6. Get Single Event (by ID or Code)
app.get("/api/event", async (req, res) => {
  const { id, code } = req.query;

  try {
    let event = null;
    if (id && isValidObjectId(id)) {
      event = await prisma.event.findUnique({
        where: { id },
        include: {
          participants: {
            include: {
              user: { select: { id: true, name: true, email: true, image: true } },
            },
          },
        },
      });
    }
    if (!event && code) {
      event = await prisma.event.findUnique({
        where: { code: String(code).trim() },
        include: {
          participants: {
            include: {
              user: { select: { id: true, name: true, email: true, image: true } },
            },
          },
        },
      });
    }

    if (!event) {
      return res.status(404).json({ success: false, error: "Event not found" });
    }

    res.json({ success: true, event });
  } catch (error) {
    console.error("❌ Get event error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch event" });
  }
});

// 7. Create Event (Admin)
app.post("/api/events", async (req, res) => {
  const { title, description, location, startDate, endDate, code, createdBy } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ success: false, error: "Event title is required" });
  }

  // Generate unique code if not provided
  let eventCode = code ? String(code).trim() : "";
  if (!eventCode) {
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    eventCode = `${slug}-${randomSuffix}`;
  }

  try {
    const existing = await prisma.event.findUnique({ where: { code: eventCode } });
    if (existing) {
      eventCode = `${eventCode}-${Date.now().toString().slice(-4)}`;
    }

    const newEvent = await prisma.event.create({
      data: {
        title: title.trim(),
        description: description ? description.trim() : null,
        location: location ? location.trim() : null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        code: eventCode,
        createdBy: createdBy && isValidObjectId(createdBy) ? createdBy : null,
        status: "active",
      },
    });

    console.log(`🎉 Created new event: ${newEvent.title} (${newEvent.code})`);
    res.json({ success: true, event: newEvent });
  } catch (error) {
    console.error("❌ Create event error:", error);
    res.status(500).json({ success: false, error: "Failed to create event" });
  }
});

// 8. Join Event (Backend persistence for authenticated user)
app.post("/api/event/join", async (req, res) => {
  const { userId, eventId, code } = req.body;

  if (!userId || (!isValidObjectId(userId))) {
    return res.status(401).json({
      success: false,
      error: "Authentication required. Only logged-in users can join an event.",
    });
  }

  try {
    // 1. Verify user exists
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ success: false, error: "User profile not found. Please sign in again." });
    }

    // 2. Find target event
    let event = null;
    if (eventId && isValidObjectId(eventId)) {
      event = await prisma.event.findUnique({ where: { id: eventId } });
    }
    if (!event && code) {
      event = await prisma.event.findUnique({ where: { code: String(code).trim() } });
    }

    if (!event) {
      return res.status(404).json({ success: false, error: "Event not found. Invalid event code or QR code." });
    }

    // 3. Upsert participant entry in database
    const participant = await prisma.eventParticipant.upsert({
      where: {
        eventId_userId: {
          eventId: event.id,
          userId: user.id,
        },
      },
      update: {
        joinedAt: new Date(),
      },
      create: {
        eventId: event.id,
        userId: user.id,
      },
    });

    console.log(`🤝 User ${user.email || user.id} joined event: ${event.title} (${event.code}) on backend`);
    res.json({ success: true, event, participant });
  } catch (error) {
    console.error("❌ Join event error:", error);
    res.status(500).json({ success: false, error: "Failed to process event join on backend" });
  }
});

// 9. Get Joined Events for a User
app.get("/api/user/joined-events", async (req, res) => {
  const { userId } = req.query;

  if (!userId || !isValidObjectId(userId)) {
    return res.status(400).json({ success: false, error: "Valid User ID is required" });
  }

  try {
    const participants = await prisma.eventParticipant.findMany({
      where: { userId: String(userId) },
      orderBy: { joinedAt: "desc" },
      include: {
        event: true,
      },
    });

    const events = participants.map((p) => ({
      ...p.event,
      joinedAt: p.joinedAt,
    }));

    res.json({ success: true, events });
  } catch (error) {
    console.error("❌ Get user joined events error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch joined events" });
  }
});

// 10. Delete Event (Admin)
app.delete("/api/events/:id", async (req, res) => {
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    return res.status(400).json({ success: false, error: "Invalid Event ID" });
  }

  try {
    await prisma.event.delete({ where: { id } });
    console.log(`🗑️ Deleted event: ${id}`);
    res.json({ success: true, message: "Event deleted successfully" });
  } catch (error) {
    console.error("❌ Delete event error:", error);
    res.status(500).json({ success: false, error: "Failed to delete event" });
  }
});

// Start the Server
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚀 Express Backend server running on port ${PORT}`);
});
