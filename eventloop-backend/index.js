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
const {
  activateMeter,
  registerTap,
  stopMeter,
} = require("./src/services/hypeMeterService");

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
      const meter = await activateMeter(hypeMeterId);
      io.to(`event:${meter.eventId}`).emit("HYPE_METER_START", {
        startedAt: meter.startedAt,
        initialScore: 0,
        hypeMeter: meter,
      });
      console.log(`🔥 Hype meter activated: ${meter.title}`);
    } catch (err) {
      console.error("❌ hype:activate error:", err);
      socket.emit("hype:error", { message: "Failed to activate hype meter" });
    }
  });

  // User taps - increment in-memory counter and broadcast instantly
  socket.on("hype:tap", async (data) => {
    const { hypeMeterId, user } = data;
    try {
      const result = await registerTap(hypeMeterId);
      if (!result) return;
      const { meter, isCompleted } = result;

      io.to(`event:${meter.eventId}`).emit("HYPE_METER_UPDATE", {
        currentScore: meter.currentTaps,
        tapsNeeded: meter.tapsNeeded,
        hypeMeterId: meter.id,
        tapper: user
          ? {
              name: user.name || "Anonymous",
              image: user.image || null,
            }
          : null,
      });

      if (isCompleted) {
        io.to(`event:${meter.eventId}`).emit("HYPE_METER_STOP", {
          finalScore: meter.currentTaps,
          hypeMeterId: meter.id,
          videoUrl: meter.videoUrl,
        });
        console.log(`🎉 Hype meter completed: ${meter.title} (${meter.currentTaps} taps)`);
      }
    } catch (err) {
      console.error("❌ hype:tap error:", err);
    }
  });

  // Admin stops a hype meter
  socket.on("hype:stop", async (data) => {
    const { hypeMeterId } = data;
    try {
      const updated = await stopMeter(hypeMeterId);
      io.to(`event:${updated.eventId}`).emit("HYPE_METER_STOP", {
        finalScore: updated.currentTaps,
        hypeMeterId: updated.id,
      });
      console.log(`🛑 Hype meter stopped by admin: ${hypeMeterId}`);
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
