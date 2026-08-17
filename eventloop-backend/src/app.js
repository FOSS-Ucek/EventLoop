const express = require("express");
const cors = require("cors");
const healthRoutes = require("./routes/healthRoutes");
const userRoutes = require("./routes/userRoutes");
const eventRoutes = require("./routes/eventRoutes");
const hypeMeterRoutes = require("./routes/hypeMeterRoutes");
const gameSessionRoutes = require("./routes/gameSessionRoutes");

const app = express();

// Configure CORS
const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
app.use(
  cors({
    origin: frontendUrl,
    credentials: true,
  })
);

// Express JSON Body Parser
app.use(express.json({ limit: "5mb" }));

// Mount API routes under /api prefix
app.use("/api", healthRoutes);
app.use("/api", userRoutes);
app.use("/api", eventRoutes);
app.use("/api", hypeMeterRoutes);
app.use("/api", gameSessionRoutes);


module.exports = app;
