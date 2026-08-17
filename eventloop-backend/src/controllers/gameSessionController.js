const prisma = require("../config/prisma");
const { isValidObjectId } = require("../utils/validation");
const {
  getGameSession: fetchGameSessionService,
  activateGameSession: activateGameSessionService,
  stopGameSession: stopGameSessionService,
  resetGameSession: resetGameSessionService,
  submitScore: submitScoreService,
  getLeaderboard,
} = require("../services/gameSessionService");

// 1. Get All Game Sessions for an Event
const getGameSessions = async (req, res) => {
  const { eventId } = req.query;

  if (!eventId || !isValidObjectId(eventId)) {
    return res.status(400).json({ success: false, error: "Valid Event ID is required" });
  }

  try {
    const rawSessions = await prisma.gameSession.findMany({
      where: { eventId },
      orderBy: { createdAt: "desc" },
    });

    const gameSessions = await Promise.all(
      rawSessions.map(async (session) => {
        const scores = await getLeaderboard(session.id);
        return {
          ...session,
          scores: scores.slice(0, 10),
        };
      })
    );

    res.json({ success: true, gameSessions });
  } catch (error) {
    console.error("❌ Get game sessions error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch game sessions" });
  }
};

// 2. Get Single Game Session with Leaderboard
const getGameSession = async (req, res) => {
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    return res.status(400).json({ success: false, error: "Invalid Game Session ID" });
  }

  try {
    const session = await fetchGameSessionService(id);
    if (!session) {
      return res.status(404).json({ success: false, error: "Game session not found" });
    }
    res.json({ success: true, gameSession: session });
  } catch (error) {
    console.error("❌ Get game session error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch game session" });
  }
};

// 3. Create Game Session (Admin)
const createGameSession = async (req, res) => {
  const { eventId, title, gameType = "dino", timeLimit = 60, createdBy } = req.body;


  if (!eventId || !isValidObjectId(eventId)) {
    return res.status(400).json({ success: false, error: "Valid Event ID is required" });
  }
  if (!title || !title.trim()) {
    return res.status(400).json({ success: false, error: "Title is required" });
  }

  const parsedTimeLimit = parseInt(timeLimit, 10);
  if (isNaN(parsedTimeLimit) || parsedTimeLimit <= 0) {
    return res.status(400).json({ success: false, error: "Time limit must be a positive integer in seconds" });
  }

  try {
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      return res.status(404).json({ success: false, error: "Event not found" });
    }

    const newSession = await prisma.gameSession.create({
      data: {
        eventId,
        title: title.trim(),
        gameType: (gameType || "tetris").toLowerCase().trim(),
        timeLimit: parsedTimeLimit,
        createdBy: createdBy && isValidObjectId(createdBy) ? createdBy : null,
      },
      include: {
        scores: true,
      },
    });

    console.log(`🎮 Created new game session: ${newSession.title} (Time limit: ${newSession.timeLimit}s)`);
    res.json({ success: true, gameSession: newSession });
  } catch (error) {
    console.error("❌ Create game session error:", error);
    res.status(500).json({ success: false, error: "Failed to create game session" });
  }
};

// 4. Delete Game Session
const deleteGameSession = async (req, res) => {
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    return res.status(400).json({ success: false, error: "Invalid Game Session ID" });
  }

  try {
    await prisma.gameSession.delete({ where: { id } });
    console.log(`🗑️ Deleted game session: ${id}`);
    res.json({ success: true, message: "Game session deleted successfully" });
  } catch (error) {
    console.error("❌ Delete game session error:", error);
    res.status(500).json({ success: false, error: "Failed to delete game session" });
  }
};

// 5. Activate Game Session
const activateGameSession = async (req, res) => {
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    return res.status(400).json({ success: false, error: "Invalid Game Session ID" });
  }

  try {
    const io = req.app.get("io");
    const updated = await activateGameSessionService(id, io);

    if (io) {
      io.to(`event:${updated.eventId}`).emit("GAME_START", {
        gameSession: updated,
        startedAt: updated.startedAt,
        endsAt: updated.endsAt,
        timeLimit: updated.timeLimit,
      });
    }

    console.log(`🚀 Activated game session: ${id} (${updated.title})`);
    res.json({ success: true, gameSession: updated });
  } catch (error) {
    console.error("❌ Activate game session error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to activate game session" });
  }
};

// 6. Stop Game Session
const stopGameSession = async (req, res) => {
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    return res.status(400).json({ success: false, error: "Invalid Game Session ID" });
  }

  try {
    const io = req.app.get("io");
    const updated = await stopGameSessionService(id, io);

    console.log(`🛑 Stopped game session: ${id}`);
    res.json({ success: true, gameSession: updated });
  } catch (error) {
    console.error("❌ Stop game session error:", error);
    res.status(500).json({ success: false, error: "Failed to stop game session" });
  }
};

// 7. Reset Game Session
const resetGameSession = async (req, res) => {
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    return res.status(400).json({ success: false, error: "Invalid Game Session ID" });
  }

  try {
    const io = req.app.get("io");
    const updated = await resetGameSessionService(id, io);

    console.log(`🔄 Reset game session: ${id}`);
    res.json({ success: true, gameSession: updated });
  } catch (error) {
    console.error("❌ Reset game session error:", error);
    res.status(500).json({ success: false, error: "Failed to reset game session" });
  }
};

// 8. Submit Score
const submitScore = async (req, res) => {
  const { id } = req.params;
  const { userId, userName, userImage, score, linesCleared } = req.body;

  if (!isValidObjectId(id)) {
    return res.status(400).json({ success: false, error: "Invalid Game Session ID" });
  }

  try {
    const io = req.app.get("io");
    const result = await submitScoreService(
      {
        gameSessionId: id,
        userId: userId && isValidObjectId(userId) ? userId : null,
        userName: userName || "Anonymous Player",
        userImage: userImage || null,
        score: parseInt(score, 10) || 0,
        linesCleared: parseInt(linesCleared, 10) || 0,
      },
      io
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error("❌ Submit score error:", error);
    res.status(500).json({ success: false, error: "Failed to submit score" });
  }
};

module.exports = {
  getGameSessions,
  getGameSession,
  createGameSession,
  deleteGameSession,
  activateGameSession,
  stopGameSession,
  resetGameSession,
  submitScore,
};
