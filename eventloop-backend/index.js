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
  activeMeters,
  activateMeter,
  registerTap,
  stopMeter,
} = require("./src/services/hypeMeterService");

const {
  activateGameSession,
  stopGameSession,
  submitScore,
} = require("./src/services/gameSessionService");

io.on("connection", (socket) => {
  // Join an event room for receiving hype & game updates
  socket.on("hype:join-room", (data) => {
    const { eventId } = data;
    if (eventId) {
      socket.join(`event:${eventId}`);
    }
  });

  // Leave an event room
  socket.on("hype:leave-room", (data) => {
    const { eventId } = data;
    if (eventId) {
      socket.leave(`event:${eventId}`);
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

  // User taps - increment in-memory counter; the broadcast loop below flushes
  // progress to the room on a fixed interval instead of once per tap, so a
  // crowd tapping concurrently doesn't turn into one socket message per tap.
  socket.on("hype:tap", async (data) => {
    const { hypeMeterId, user } = data;
    try {
      const tapper = user
        ? { name: user.name || "Anonymous", image: user.image || null }
        : null;
      const result = await registerTap(hypeMeterId, tapper);
      if (!result) return;
      const { meter, isCompleted } = result;

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

  // ── GAME SOCKET LISTENERS ──

  // Admin activates a game session
  socket.on("game:activate", async (data) => {
    const { gameSessionId } = data;
    try {
      const session = await activateGameSession(gameSessionId, io);
      io.to(`event:${session.eventId}`).emit("GAME_START", {
        gameSession: session,
        startedAt: session.startedAt,
        endsAt: session.endsAt,
        timeLimit: session.timeLimit,
      });
      console.log(`🎮 Game session activated via socket: ${session.title}`);
    } catch (err) {
      console.error("❌ game:activate error:", err);
      socket.emit("game:error", { message: err.message || "Failed to activate game session" });
    }
  });

  // Admin stops a game session
  socket.on("game:stop", async (data) => {
    const { gameSessionId } = data;
    try {
      await stopGameSession(gameSessionId, io);
      console.log(`🛑 Game session stopped via socket: ${gameSessionId}`);
    } catch (err) {
      console.error("❌ game:stop error:", err);
    }
  });

  // User submits live score during gameplay
  socket.on("game:score-update", async (data) => {
    const { gameSessionId, userId, userName, userImage, score, linesCleared } = data;
    try {
      await submitScore(
        {
          gameSessionId,
          userId,
          userName: userName || "Player",
          userImage: userImage || null,
          score: score || 0,
          linesCleared: linesCleared || 0,
        },
        io
      );
    } catch (err) {
      console.error("❌ game:score-update error:", err);
    }
  });

});

// Flush batched hype-meter progress every 120ms instead of broadcasting per
// tap - collapses a burst of concurrent taps into one HYPE_METER_UPDATE per
// meter per interval, which is what actually made 180 concurrent tappers
// affordable on a resource-constrained instance.
setInterval(() => {
  for (const [, meter] of activeMeters.entries()) {
    if (meter.pendingBroadcast && meter.status === "active") {
      meter.pendingBroadcast = false;
      const tappers = meter.pendingTappers || [];
      meter.pendingTappers = [];

      io.to(`event:${meter.eventId}`).emit("HYPE_METER_UPDATE", {
        currentScore: meter.currentTaps,
        tapsNeeded: meter.tapsNeeded,
        hypeMeterId: meter.id,
        tapper: tappers.length ? tappers[tappers.length - 1] : null,
        tappers,
      });
    }
  }
}, 120);

// Start Server
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚀 Express Backend server running on port ${PORT}`);
});
