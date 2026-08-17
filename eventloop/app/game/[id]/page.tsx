"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { io, Socket } from "socket.io-client";
import { Trophy, Timer, Gamepad2, Maximize, Crown, Award, Zap } from "lucide-react";

interface GameScore {
  id: string;
  userName: string;
  userImage?: string | null;
  score: number;
  linesCleared?: number;
  userId?: string | null;
}

function deduplicateScores(scores: GameScore[] = []): GameScore[] {
  const seen = new Set<string>();
  return scores.filter((item) => {
    const key = item.userId
      ? `id_${item.userId}`
      : `name_${(item.userName || "").toLowerCase().trim()}`;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

interface GameSessionData {
  id: string;
  eventId: string;
  gameType: string;
  title: string;
  timeLimit: number;
  status: string;
  startedAt: string | null;
  endsAt: string | null;
  leaderboard?: GameScore[];
  event?: { title: string };
}

export default function GameDisplayScreen() {
  const { id } = useParams();
  const [game, setGame] = useState<GameSessionData | null>(null);
  const [leaderboard, setLeaderboard] = useState<GameScore[]>([]);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
    };
  }, []);

  // Fetch Game Session details and join socket room
  useEffect(() => {
    if (!id) return;

    const newSocket = io(backendUrl);
    socketRef.current = newSocket;

    const fetchGame = async () => {
      try {
        const res = await fetch(`${backendUrl}/api/game-sessions/${id}`);
        const data = await res.json();

        if (res.ok && data.success && data.gameSession) {
          setGame(data.gameSession);
          setLeaderboard(deduplicateScores(data.gameSession.leaderboard || []));

          if (newSocket.connected) {
            newSocket.emit("hype:join-room", { eventId: data.gameSession.eventId });
          } else {
            newSocket.once("connect", () => {
              newSocket.emit("hype:join-room", { eventId: data.gameSession.eventId });
            });
          }
        } else {
          setError(data.error || "Game session not found");
        }
      } catch (err) {
        setError("Network error fetching game session");
      } finally {
        setLoading(false);
      }

    };

    fetchGame();

    // Socket Event Handlers
    const handleLeaderboardUpdate = (payload: {
      gameSessionId: string;
      leaderboard: GameScore[];
      endsAt?: string;
    }) => {
      if (payload.gameSessionId === id) {
        setLeaderboard(deduplicateScores(payload.leaderboard || []));
        if (payload.endsAt) {
          setGame((prev) => (prev ? { ...prev, endsAt: payload.endsAt! } : prev));
        }
      }
    };

    const handleGameStart = (payload: { gameSession: GameSessionData }) => {
      if (payload.gameSession?.id === id) {
        setGame(payload.gameSession);
        setLeaderboard(deduplicateScores(payload.gameSession.leaderboard || []));
      }
    };

    const handleGameStop = (payload: { gameSessionId: string; finalLeaderboard?: GameScore[] }) => {
      if (payload.gameSessionId === id) {
        setGame((prev) => (prev ? { ...prev, status: "completed" } : prev));
        if (payload.finalLeaderboard) {
          setLeaderboard(deduplicateScores(payload.finalLeaderboard));
        }
      }
    };

    newSocket.on("GAME_LEADERBOARD_UPDATE", handleLeaderboardUpdate);
    newSocket.on("GAME_START", handleGameStart);
    newSocket.on("GAME_STOP", handleGameStop);

    return () => {
      newSocket.off("GAME_LEADERBOARD_UPDATE", handleLeaderboardUpdate);
      newSocket.off("GAME_START", handleGameStart);
      newSocket.off("GAME_STOP", handleGameStop);
      newSocket.disconnect();
    };
  }, [id, backendUrl]);

  // Live Timer Countdown Calculation
  useEffect(() => {
    if (!game?.endsAt || game.status !== "active") return;

    const updateTimer = () => {
      const endsTime = new Date(game.endsAt!).getTime();
      const now = Date.now();
      const diffSec = Math.max(0, Math.ceil((endsTime - now) / 1000));
      setRemainingSeconds(diffSec);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 500);
    return () => clearInterval(interval);
  }, [game]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-zinc-800 border-t-emerald-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-zinc-500 text-2xl font-bold">
        {error || "Game session not found"}
      </div>
    );
  }

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const formattedTime = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  const isCompleted = game.status === "completed";

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden flex flex-col items-center justify-between relative select-none w-full p-6 sm:p-12">
      {/* Fullscreen Button */}
      {!isFullscreen && (
        <button
          onClick={toggleFullscreen}
          className="fixed top-6 right-6 z-[250] p-3 bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-700 text-white rounded-xl backdrop-blur-md transition-all shadow-lg flex items-center gap-2 text-xs font-semibold"
        >
          <Maximize className="w-4 h-4" />
          <span>Fullscreen</span>
        </button>
      )}

      {/* Ambient background blur circles */}
      <div className="absolute top-1/4 left-1/3 w-[600px] h-[600px] bg-emerald-900/20 rounded-full blur-[160px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 w-[600px] h-[600px] bg-amber-900/15 rounded-full blur-[160px] pointer-events-none" />

      {/* Header Info */}
      <div className="relative z-10 w-full max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-6 border-b border-zinc-800 pb-6">
        <div className="flex items-center gap-4 text-center sm:text-left">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shadow-lg shadow-emerald-500/10">
            <Gamepad2 className="w-8 h-8 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">{game.title}</h1>
              <span className="px-2.5 py-1 text-xs font-black uppercase rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-800">
                {game.gameType}
              </span>
            </div>
            <p className="text-sm text-zinc-400 mt-1">Real-Time Tournament Arena</p>
          </div>
        </div>

        {/* Countdown Timer Display */}
        <div className="flex items-center gap-4 bg-zinc-900/80 border border-zinc-800 px-6 py-3 rounded-2xl shadow-2xl backdrop-blur-md">
          <Timer className="w-8 h-8 text-emerald-400" />
          <div>
            <span className="text-[10px] uppercase font-bold text-zinc-500 block tracking-widest">
              {isCompleted ? "STATUS" : "TIME REMAINING"}
            </span>
            <span
              className={`text-3xl sm:text-4xl font-black font-mono tracking-wider ${
                isCompleted
                  ? "text-red-500"
                  : remainingSeconds <= 10
                  ? "text-red-500 animate-pulse"
                  : remainingSeconds <= 30
                  ? "text-amber-400"
                  : "text-emerald-400"
              }`}
            >
              {isCompleted ? "FINISHED" : formattedTime}
            </span>
          </div>
        </div>
      </div>

      {/* Main Leaderboard Section */}
      <div className="relative z-10 w-full max-w-7xl my-8 flex-1 flex flex-col justify-center">
        {isCompleted && leaderboard.length > 0 ? (
          /* Winner Podium View */
          <div className="w-full flex flex-col items-center space-y-12 animate-scale-in">
            <div className="text-center space-y-2">
              <Crown className="w-20 h-20 text-amber-400 mx-auto animate-bounce" />
              <h2 className="text-4xl sm:text-6xl font-black text-white tracking-tight">
                TOURNAMENT CHAMPIONS
              </h2>
              <p className="text-zinc-400 text-lg">Final Standing & Real-Time Winners</p>
            </div>

            {/* Podium */}
            <div className="grid grid-cols-3 gap-4 sm:gap-8 items-end max-w-3xl w-full">
              {/* 2nd Place */}
              {leaderboard[1] && (
                <div className="flex flex-col items-center space-y-3">
                  <div className="w-16 h-16 rounded-full bg-slate-800 border-2 border-slate-400 flex items-center justify-center font-bold text-2xl">
                    🥈
                  </div>
                  <span className="font-extrabold text-lg text-slate-200 text-center line-clamp-1">
                    {leaderboard[1].userName}
                  </span>
                  <div className="w-full bg-slate-900/90 border border-slate-700/60 rounded-t-2xl py-8 text-center shadow-2xl">
                    <span className="text-2xl font-black text-white">{leaderboard[1].score}</span>
                    <span className="text-xs text-zinc-400 block font-semibold">PTS</span>
                  </div>
                </div>
              )}

              {/* 1st Place */}
              {leaderboard[0] && (
                <div className="flex flex-col items-center space-y-3">
                  <div className="w-20 h-20 rounded-full bg-amber-500/20 border-4 border-amber-400 flex items-center justify-center font-bold text-3xl shadow-xl shadow-amber-500/20 animate-pulse">
                    🥇
                  </div>
                  <span className="font-black text-xl text-amber-400 text-center line-clamp-1">
                    {leaderboard[0].userName}
                  </span>
                  <div className="w-full bg-amber-950/80 border-2 border-amber-500/60 rounded-t-3xl py-12 text-center shadow-2xl">
                    <span className="text-4xl font-black text-amber-400">{leaderboard[0].score}</span>
                    <span className="text-xs text-amber-200 block font-bold">WINNER</span>
                  </div>
                </div>
              )}

              {/* 3rd Place */}
              {leaderboard[2] && (
                <div className="flex flex-col items-center space-y-3">
                  <div className="w-16 h-16 rounded-full bg-amber-950 border-2 border-amber-700 flex items-center justify-center font-bold text-2xl">
                    🥉
                  </div>
                  <span className="font-extrabold text-lg text-amber-600 text-center line-clamp-1">
                    {leaderboard[2].userName}
                  </span>
                  <div className="w-full bg-zinc-900/90 border border-amber-900/60 rounded-t-2xl py-6 text-center shadow-2xl">
                    <span className="text-2xl font-black text-white">{leaderboard[2].score}</span>
                    <span className="text-xs text-zinc-400 block font-semibold">PTS</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Live Ranking Grid */
          <div className="w-full space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-xl font-bold flex items-center gap-2 text-white">
                <Trophy className="w-6 h-6 text-amber-400" />
                Live Standings ({leaderboard.length} Players)
              </h3>
              <span className="text-xs font-mono text-zinc-500 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                REAL-TIME LIVE
              </span>
            </div>

            {leaderboard.length === 0 ? (
              <div className="text-center py-20 text-zinc-500 text-xl font-medium">
                Waiting for players to submit scores... Run distance in Dino Runner to reach the top!
              </div>

            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto pr-2">
                {leaderboard.map((item, index) => {
                  const rankColor =
                    index === 0
                      ? "bg-amber-500/10 border-amber-500/40 text-amber-400"
                      : index === 1
                      ? "bg-slate-400/10 border-slate-400/30 text-slate-300"
                      : index === 2
                      ? "bg-amber-800/10 border-amber-700/30 text-amber-600"
                      : "bg-zinc-900/60 border-zinc-800 text-zinc-300";

                  return (
                    <div
                      key={item.id || index}
                      className={`flex items-center justify-between p-4 rounded-2xl border backdrop-blur-md transition-all duration-300 ${rankColor}`}
                    >
                      <div className="flex items-center gap-4">
                        <span className="text-2xl font-black font-mono w-10 text-center">
                          #{index + 1}
                        </span>
                        {item.userImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.userImage}
                            alt="Avatar"
                            className="w-10 h-10 rounded-full object-cover border border-zinc-700"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-zinc-800 text-white font-bold text-base flex items-center justify-center border border-zinc-700">
                            {(item.userName || "U").substring(0, 1).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <h4 className="font-extrabold text-base text-white">{item.userName}</h4>
                          {item.linesCleared !== undefined && (
                            <span className="text-xs text-zinc-400">{item.linesCleared} lines cleared</span>
                          )}
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-2xl font-black text-white">{item.score}</span>
                        <span className="text-[10px] text-zinc-500 block font-bold">POINTS</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Branding */}
      <div className="relative z-10 w-full max-w-7xl flex items-center justify-between border-t border-zinc-800 pt-4 text-xs text-zinc-500">
        <span>EventLoop Sub-Event Platform</span>
        <span>Real-Time Socket Sync</span>
      </div>
    </div>
  );
}
