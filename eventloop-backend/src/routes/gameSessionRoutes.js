const express = require("express");
const router = express.Router();
const {
  getGameSessions,
  getGameSession,
  createGameSession,
  deleteGameSession,
  activateGameSession,
  stopGameSession,
  resetGameSession,
  submitScore,
} = require("../controllers/gameSessionController");

router.get("/game-sessions", getGameSessions);
router.get("/game-sessions/:id", getGameSession);
router.post("/game-sessions", createGameSession);
router.delete("/game-sessions/:id", deleteGameSession);
router.post("/game-sessions/:id/activate", activateGameSession);
router.post("/game-sessions/:id/stop", stopGameSession);
router.post("/game-sessions/:id/reset", resetGameSession);
router.post("/game-sessions/:id/score", submitScore);

module.exports = router;
