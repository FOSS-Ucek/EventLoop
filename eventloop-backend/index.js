require("dotenv").config();
const http = require("http");
const { Server } = require("socket.io");
const app = require("./src/app");

const server = http.createServer(app);

// Configure Socket.io
const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
const io = new Server(server, {
  cors: {
    origin: frontendUrl,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.set("io", io);

const prisma = require("./src/config/prisma");

io.on("connection", (socket) => {
  console.log(`📡 Socket connected: ${socket.id}`);

  // Join an event room for receiving hype updates
  socket.on("hype:join-room", (data) => {
    const { eventId } = data;
    if (eventId) {
      socket.join(`event:${eventId}`);
      console.log(`🔥 Socket ${socket.id} joined hype room: event:${eventId}`);
    }
  });

  // Leave an event room
  socket.on("hype:leave-room", (data) => {
    const { eventId } = data;
    if (eventId) {
      socket.leave(`event:${eventId}`);
      console.log(`👋 Socket ${socket.id} left hype room: event:${eventId}`);
    }
  });

  // Admin activates a hype meter - broadcast to all participants in the event room
  socket.on("hype:activate", async (data) => {
    const { hypeMeterId } = data;
    try {
      const meterToActivate = await prisma.hypeMeter.findUnique({ where: { id: hypeMeterId } });
      if (meterToActivate) {
        await prisma.hypeMeter.updateMany({
          where: { eventId: meterToActivate.eventId, status: "active" },
          data: { status: "pending" },
        });
      }

      const meter = await prisma.hypeMeter.update({
        where: { id: hypeMeterId },
        data: { status: "active", currentTaps: 0, startedAt: new Date() },
        include: { event: true },
      });
      io.to(`event:${meter.eventId}`).emit("HYPE_METER_START", {
        startedAt: meter.startedAt,
        initialScore: 0,
        hypeMeter: meter
      });
      console.log(`🔥 Hype meter activated: ${meter.title} for event ${meter.event.title}`);
    } catch (err) {
      console.error("❌ hype:activate error:", err);
      socket.emit("hype:error", { message: "Failed to activate hype meter" });
    }
  });

  // User taps - increment and broadcast
  socket.on("hype:tap", async (data) => {
    const { hypeMeterId, user } = data;
    try {
      const meter = await prisma.hypeMeter.findUnique({ where: { id: hypeMeterId } });
      if (!meter || meter.status !== "active") return;

      // Don't increment past tapsNeeded
      if (meter.currentTaps >= meter.tapsNeeded) return;

      const updated = await prisma.hypeMeter.update({
        where: { id: hypeMeterId },
        data: { currentTaps: { increment: 1 } },
      });

      const percentage = Math.min(100, Math.round((updated.currentTaps / updated.tapsNeeded) * 100));

      io.to(`event:${updated.eventId}`).emit("HYPE_METER_UPDATE", {
        currentScore: updated.currentTaps,
        tapsNeeded: updated.tapsNeeded,
        hypeMeterId: updated.id,
        tapper: user ? {
          name: user.name || "Anonymous",
          image: user.image || null,
        } : null,
      });

      // Check if completed
      if (updated.currentTaps >= updated.tapsNeeded) {
        const completed = await prisma.hypeMeter.update({
          where: { id: hypeMeterId },
          data: { status: "completed" },
        });
        io.to(`event:${updated.eventId}`).emit("HYPE_METER_STOP", {
          finalScore: updated.currentTaps,
          hypeMeterId: updated.id,
          videoUrl: updated.videoUrl,
        });
        console.log(`🎉 Hype meter completed: ${meter.title}`);
      }
    } catch (err) {
      console.error("❌ hype:tap error:", err);
    }
  });

  // Admin stops a hype meter
  socket.on("hype:stop", async (data) => {
    const { hypeMeterId } = data;
    try {
      const meter = await prisma.hypeMeter.findUnique({ where: { id: hypeMeterId } });
      if (!meter || meter.status !== "active") return;

      const updated = await prisma.hypeMeter.update({
        where: { id: hypeMeterId },
        data: { status: "stopped" },
      });

      io.to(`event:${updated.eventId}`).emit("HYPE_METER_STOP", {
        finalScore: updated.currentTaps,
        hypeMeterId: updated.id,
      });
      console.log(`🛑 Hype meter stopped by admin: ${meter.title}`);
    } catch (err) {
      console.error("❌ hype:stop error:", err);
    }
  });

  socket.on("disconnect", () => {
    console.log(`🔌 Socket disconnected: ${socket.id}`);
  });
});

// Start Server
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚀 Express Backend server running on port ${PORT}`);
});
