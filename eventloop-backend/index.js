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

io.on("connection", (socket) => {
  console.log(`📡 Socket connected: ${socket.id}`);

  socket.on("disconnect", () => {
    console.log(`🔌 Socket disconnected: ${socket.id}`);
  });
});

// Start Server
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚀 Express Backend server running on port ${PORT}`);
});
