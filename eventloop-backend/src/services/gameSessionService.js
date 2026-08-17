const prisma = require("../config/prisma");

// In-memory active game sessions cache & timers
const activeGames = new Map();
const gameTimers = new Map();
const submitLocks = new Map();

/**
 * Fetch top 50 unique leaderboard scores for a game session
 * Automatically cleans up duplicate records from DB
 */
async function getLeaderboard(gameSessionId) {
  if (!gameSessionId) return [];

  const scores = await prisma.gameScore.findMany({
    where: { gameSessionId },
    orderBy: [{ score: "desc" }, { updatedAt: "asc" }],
  });

  const uniqueScores = [];
  const seenUserKeys = new Set();
  const duplicateIds = [];

  for (const score of scores) {
    const key = score.userId
      ? `id:${score.userId}`
      : `name:${(score.userName || "").toLowerCase().trim()}`;

    if (key && !seenUserKeys.has(key)) {
      seenUserKeys.add(key);
      uniqueScores.push(score);
    } else {
      duplicateIds.push(score.id);
    }
  }

  if (duplicateIds.length > 0) {
    prisma.gameScore
      .deleteMany({
        where: { id: { in: duplicateIds } },
      })
      .catch((err) => console.error("❌ Failed to clean duplicate game scores:", err));
  }

  return uniqueScores.slice(0, 50);
}

/**
 * Get active game from in-memory cache or DB
 */
async function getGameSession(id) {
  let session = activeGames.get(id);
  if (session) {
    session.leaderboard = await getLeaderboard(id);
    return session;
  }

  const dbSession = await prisma.gameSession.findUnique({
    where: { id },
    include: {
      event: true,
    },
  });

  if (!dbSession) return null;

  const leaderboard = await getLeaderboard(id);

  const formatted = {
    id: dbSession.id,
    eventId: dbSession.eventId,
    gameType: dbSession.gameType,
    title: dbSession.title,
    timeLimit: dbSession.timeLimit,
    status: dbSession.status,
    startedAt: dbSession.startedAt,
    endsAt: dbSession.endsAt,
    event: dbSession.event,
    leaderboard,
  };

  if (dbSession.status === "active") {
    activeGames.set(id, formatted);
  }

  return formatted;
}

/**
 * Activate a game session in memory and DB
 */
async function activateGameSession(id, io) {
  const existing = await prisma.gameSession.findUnique({ where: { id } });
  if (!existing) throw new Error("Game session not found");

  // Deactivate any other active game for the same event
  await prisma.gameSession.updateMany({
    where: { eventId: existing.eventId, status: "active" },
    data: { status: "pending" },
  });

  // Clear any existing timer
  if (gameTimers.has(id)) {
    clearTimeout(gameTimers.get(id));
    gameTimers.delete(id);
  }

  const now = new Date();
  const endsAt = new Date(now.getTime() + existing.timeLimit * 1000);

  const dbSession = await prisma.gameSession.update({
    where: { id },
    data: {
      status: "active",
      startedAt: now,
      endsAt: endsAt,
    },
    include: {
      event: true,
    },
  });

  const leaderboard = await getLeaderboard(id);

  const session = {
    id: dbSession.id,
    eventId: dbSession.eventId,
    gameType: dbSession.gameType,
    title: dbSession.title,
    timeLimit: dbSession.timeLimit,
    status: "active",
    startedAt: dbSession.startedAt,
    endsAt: dbSession.endsAt,
    event: dbSession.event,
    leaderboard,
  };

  activeGames.set(id, session);

  // Set automatic countdown completion timer
  const remainingMs = Math.max(0, endsAt.getTime() - Date.now());
  const timer = setTimeout(async () => {
    try {
      await stopGameSession(id, io);
    } catch (err) {
      console.error(`❌ Error auto-stopping game session ${id}:`, err);
    }
  }, remainingMs);

  gameTimers.set(id, timer);

  return session;
}

/**
 * Stop an active game session
 */
async function stopGameSession(id, io) {
  if (gameTimers.has(id)) {
    clearTimeout(gameTimers.get(id));
    gameTimers.delete(id);
  }

  activeGames.delete(id);

  await prisma.gameSession.update({
    where: { id },
    data: { status: "completed" },
  });

  const dbSession = await prisma.gameSession.findUnique({
    where: { id },
    include: { event: true },
  });

  const finalLeaderboard = await getLeaderboard(id);

  if (io && dbSession) {
    io.to(`event:${dbSession.eventId}`).emit("GAME_STOP", {
      gameSessionId: dbSession.id,
      gameType: dbSession.gameType,
      title: dbSession.title,
      finalLeaderboard,
    });
  }

  return {
    ...dbSession,
    finalLeaderboard,
  };
}

/**
 * Reset a game session (clears scores and sets to pending)
 */
async function resetGameSession(id, io) {
  if (gameTimers.has(id)) {
    clearTimeout(gameTimers.get(id));
    gameTimers.delete(id);
  }

  activeGames.delete(id);

  // Delete associated scores
  await prisma.gameScore.deleteMany({
    where: { gameSessionId: id },
  });

  const dbSession = await prisma.gameSession.update({
    where: { id },
    data: {
      status: "pending",
      startedAt: null,
      endsAt: null,
    },
    include: {
      scores: true,
    },
  });

  if (io) {
    io.to(`event:${dbSession.eventId}`).emit("GAME_STOP", {
      gameSessionId: dbSession.id,
      reset: true,
    });
  }

  return dbSession;
}

/**
 * Submit or update user score in game session with strict deduplication & lock handling
 */
async function submitScore({ gameSessionId, userId, userName, userImage, score, linesCleared = 0 }, io) {
  let session = activeGames.get(gameSessionId);
  if (!session) {
    session = await getGameSession(gameSessionId);
  }

  if (!session || session.status !== "active") {
    return { success: false, error: "Game session is not active" };
  }

  const cleanUserId = userId && typeof userId === "string" && userId.trim() !== "" ? userId.trim() : null;
  const cleanUserName = userName && typeof userName === "string" && userName.trim() !== "" ? userName.trim() : "Player";
  const numScore = parseInt(score, 10) || 0;
  const numLines = parseInt(linesCleared, 10) || 0;

  // Lock key per user/session to avoid concurrent race condition inserts
  const lockKey = `${gameSessionId}_${cleanUserId || cleanUserName.toLowerCase()}`;

  if (submitLocks.has(lockKey)) {
    try {
      await submitLocks.get(lockKey);
    } catch (_) {}
  }

  let resolveLock;
  const lockPromise = new Promise((resolve) => {
    resolveLock = resolve;
  });
  submitLocks.set(lockKey, lockPromise);

  let updatedScore = null;
  try {
    let existingScores = [];
    if (cleanUserId) {
      existingScores = await prisma.gameScore.findMany({
        where: {
          gameSessionId,
          OR: [
            { userId: cleanUserId },
            { userId: null, userName: cleanUserName },
          ],
        },
        orderBy: { score: "desc" },
      });
    } else {
      existingScores = await prisma.gameScore.findMany({
        where: {
          gameSessionId,
          userId: null,
          userName: cleanUserName,
        },
        orderBy: { score: "desc" },
      });
    }

    if (existingScores.length > 0) {
      const primary = existingScores[0];

      // Delete any duplicate secondary records if present
      if (existingScores.length > 1) {
        const extraIds = existingScores.slice(1).map((s) => s.id);
        await prisma.gameScore.deleteMany({
          where: { id: { in: extraIds } },
        });
      }

      const newHighScore = Math.max(primary.score, numScore);
      updatedScore = await prisma.gameScore.update({
        where: { id: primary.id },
        data: {
          score: newHighScore,
          linesCleared: newHighScore === numScore ? numLines : primary.linesCleared,
          userName: cleanUserName,
          userImage: userImage || primary.userImage,
          userId: cleanUserId || primary.userId,
        },
      });
    } else {
      updatedScore = await prisma.gameScore.create({
        data: {
          gameSessionId,
          userId: cleanUserId,
          userName: cleanUserName,
          userImage: userImage || null,
          score: numScore,
          linesCleared: numLines,
        },
      });
    }
  } finally {
    resolveLock();
    if (submitLocks.get(lockKey) === lockPromise) {
      submitLocks.delete(lockKey);
    }
  }

  // Fetch deduplicated top 50 leaderboard
  const topScores = await getLeaderboard(gameSessionId);

  if (session) {
    session.leaderboard = topScores;
  }

  // Broadcast real-time leaderboard update with countdown remaining
  if (io && session) {
    const remainingSeconds = session.endsAt
      ? Math.max(0, Math.floor((new Date(session.endsAt).getTime() - Date.now()) / 1000))
      : 0;

    io.to(`event:${session.eventId}`).emit("GAME_LEADERBOARD_UPDATE", {
      gameSessionId,
      gameType: session.gameType,
      title: session.title,
      leaderboard: topScores,
      remainingSeconds,
      endsAt: session.endsAt,
      latestScore: updatedScore,
    });
  }

  return { success: true, leaderboard: topScores, score: updatedScore };
}

module.exports = {
  activeGames,
  getGameSession,
  activateGameSession,
  stopGameSession,
  resetGameSession,
  submitScore,
  getLeaderboard,
};
