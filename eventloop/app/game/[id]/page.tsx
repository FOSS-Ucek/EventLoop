"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { io, Socket } from "socket.io-client";
import { Maximize, Minimize, Crown, Sparkles } from "lucide-react";

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
      <div className="min-h-screen bg-[#050508] flex items-center justify-center">
        <div className="relative">
          <div className="w-14 h-14 border-2 border-emerald-500/20 border-t-emerald-400 rounded-full animate-spin" />
          <div className="absolute inset-0 blur-lg bg-emerald-500/20 rounded-full animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="min-h-screen bg-[#050508] flex items-center justify-center text-zinc-400 text-lg font-medium">
        {error || "Game session not found"}
      </div>
    );
  }

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const formattedTime = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  const isCompleted = game.status === "completed";

  return (
    <div className="min-h-screen bg-[#050508] text-white overflow-hidden flex flex-col items-center justify-start relative select-none w-full p-4 sm:p-8 font-sans">
      {/* Floating Header HUD (Minimal & Clean, No App Bar) */}
      <header className="relative z-20 w-full max-w-5xl flex items-center justify-end gap-4 pt-2 pb-4">
        {/* Right: Timer Pill & Fullscreen Toggle */}
        <div className="flex items-center gap-3 animate-fade-in">
          {/* Timer HUD Pill */}
          <div className="flex items-center gap-2.5 bg-white/[0.03] backdrop-blur-2xl border border-white/[0.08] px-4 py-2 rounded-full shadow-2xl">
            <div className={`w-2 h-2 rounded-full ${isCompleted ? "bg-red-500" : "bg-emerald-400 animate-ping"}`} />
            <span className="text-xs font-mono font-bold tracking-wider text-zinc-300 uppercase">
              {isCompleted ? "FINISHED" : formattedTime}
            </span>
          </div>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className="p-2.5 rounded-full bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.08] text-zinc-300 hover:text-white backdrop-blur-2xl transition-all shadow-xl active:scale-95"
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Leaderboard Section */}
      <main className="relative z-10 w-full max-w-5xl flex-1 flex flex-col justify-start pt-2 pb-6">
        {isCompleted && leaderboard.length > 0 ? (
          /* Winner Podium View */
          <div className="w-full flex flex-col items-center space-y-10 animate-scale-in">
            {/* Header Badge */}
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono font-bold uppercase tracking-widest mb-2 animate-bounce">
                <Crown className="w-3.5 h-3.5" /> Final Standings
              </div>
              <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
                Tournament Champions
              </h2>
            </div>

            {/* Podium Cards */}
            <div className="grid grid-cols-3 gap-3 sm:gap-6 items-end max-w-2xl w-full pt-4">
              {/* 2nd Place */}
              {leaderboard[1] && (
                <div className="flex flex-col items-center space-y-3 animate-slide-up stagger-1">
                  <div className="w-14 h-14 rounded-2xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-center font-bold text-xl shadow-lg backdrop-blur-xl">
                    🥈
                  </div>
                  <span className="font-bold text-sm text-slate-200 text-center line-clamp-1">
                    {leaderboard[1].userName}
                  </span>
                  <div className="w-full bg-slate-900/40 border border-slate-700/40 rounded-2xl py-6 text-center shadow-xl backdrop-blur-xl">
                    <span className="text-2xl font-black font-mono text-white">{leaderboard[1].score}</span>
                    <span className="text-[10px] text-slate-400 block font-mono font-bold uppercase mt-0.5">PTS</span>
                  </div>
                </div>
              )}

              {/* 1st Place (Gold Winner) */}
              {leaderboard[0] && (
                <div className="flex flex-col items-center space-y-3 animate-scale-in -translate-y-3">
                  <div className="relative">
                    <div className="w-18 h-18 rounded-2xl bg-amber-500/20 border-2 border-amber-400/70 flex items-center justify-center font-bold text-3xl shadow-2xl shadow-amber-500/30 backdrop-blur-xl animate-float">
                      🥇
                    </div>
                    <Sparkles className="w-5 h-5 text-amber-300 absolute -top-2 -right-2 animate-pulse" />
                  </div>
                  <span className="font-extrabold text-base text-amber-300 text-center line-clamp-1">
                    {leaderboard[0].userName}
                  </span>
                  <div className="w-full bg-zinc-900/80 border-2 border-amber-500/50 rounded-2xl py-8 text-center shadow-2xl backdrop-blur-xl">
                    <span className="text-4xl font-black font-mono text-amber-400 tracking-tight">{leaderboard[0].score}</span>
                    <span className="text-[10px] text-amber-200/70 block font-mono font-bold uppercase mt-1">WINNER</span>
                  </div>
                </div>
              )}

              {/* 3rd Place */}
              {leaderboard[2] && (
                <div className="flex flex-col items-center space-y-3 animate-slide-up stagger-2">
                  <div className="w-14 h-14 rounded-2xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-center font-bold text-xl shadow-lg backdrop-blur-xl">
                    🥉
                  </div>
                  <span className="font-bold text-sm text-amber-600 text-center line-clamp-1">
                    {leaderboard[2].userName}
                  </span>
                  <div className="w-full bg-zinc-900/40 border border-amber-900/40 rounded-2xl py-5 text-center shadow-xl backdrop-blur-xl">
                    <span className="text-2xl font-black font-mono text-white">{leaderboard[2].score}</span>
                    <span className="text-[10px] text-zinc-500 block font-mono font-bold uppercase mt-0.5">PTS</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Live Standings View */
          <div className="w-full flex flex-col items-center space-y-6 animate-fade-in">
            <h2 className="text-2xl sm:text-4xl font-black tracking-widest uppercase text-white text-center">
              Leaderboard
            </h2>

            {leaderboard.length === 0 ? (
              <div className="w-full flex flex-col items-center space-y-6">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.08] text-zinc-400 text-xs font-mono font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  Awaiting Tournament Scores...
                </div>

                {/* Skeleton Tiles Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full opacity-60">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-4 sm:p-5 rounded-2xl border border-white/[0.06] bg-zinc-900/40 backdrop-blur-xl animate-pulse"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-11 h-11 rounded-xl bg-white/10" />
                        <div className="flex items-center gap-3.5">
                          <div className="w-11 h-11 rounded-xl bg-white/10" />
                          <div className="space-y-2">
                            <div className="w-28 h-4 rounded bg-white/10" />
                            <div className="w-16 h-3 rounded bg-white/5" />
                          </div>
                        </div>
                      </div>
                      <div className="w-14 h-7 rounded-lg bg-white/10" />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-h-[80vh] overflow-y-auto px-1">
                {leaderboard.map((item, index) => {
                  const isGold = index === 0;
                  const isSilver = index === 1;
                  const isBronze = index === 2;

                  const cardStyle = isGold
                    ? "bg-zinc-900/90 hover:bg-zinc-900 border-amber-500/40 text-white shadow-xl"
                    : isSilver
                    ? "bg-zinc-900/70 hover:bg-zinc-900 border-slate-400/30 text-white"
                    : isBronze
                    ? "bg-zinc-900/70 hover:bg-zinc-900 border-amber-800/30 text-white"
                    : "bg-white/[0.03] hover:bg-white/[0.06] border-white/[0.08] hover:border-white/[0.14] text-zinc-200";

                  const badgeStyle = isGold
                    ? "bg-amber-500/20 text-amber-300 border-amber-400/50"
                    : isSilver
                    ? "bg-slate-400/20 text-slate-200 border-slate-300/50"
                    : isBronze
                    ? "bg-amber-800/20 text-amber-400 border-amber-700/50"
                    : "bg-white/[0.05] text-zinc-400 border-white/[0.08]";

                  return (
                    <div
                      key={item.id || index}
                      className={`flex items-center justify-between p-4 sm:p-5 rounded-2xl border backdrop-blur-xl transition-all duration-300 group hover:scale-[1.01] ${cardStyle}`}
                    >
                      <div className="flex items-center gap-4">
                        {/* Rank Badge */}
                        <div
                          className={`w-11 h-11 rounded-xl border flex items-center justify-center font-mono font-black text-sm sm:text-base ${badgeStyle}`}
                        >
                          {isGold ? "🥇" : isSilver ? "🥈" : isBronze ? "🥉" : `#${index + 1}`}
                        </div>

                        {/* Avatar & User Details */}
                        <div className="flex items-center gap-3.5">
                          {item.userImage ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.userImage}
                              alt="Avatar"
                              className="w-11 h-11 rounded-xl object-cover border border-white/10"
                            />
                          ) : (
                            <div className="w-11 h-11 rounded-xl bg-zinc-800 border border-white/10 text-white font-black text-sm flex items-center justify-center">
                              {(item.userName || "U").substring(0, 1).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <h3 className="font-black text-base sm:text-lg text-white group-hover:text-emerald-300 transition-colors line-clamp-1">
                              {item.userName}
                            </h3>
                            {item.linesCleared !== undefined && item.linesCleared > 0 && (
                              <span className="text-xs text-zinc-400 font-mono font-semibold">
                                {item.linesCleared} distance
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Score Value */}
                      <div className="text-right pl-3">
                        <span className="text-2xl sm:text-3xl font-black font-mono text-white tracking-tight group-hover:text-emerald-400 transition-colors">
                          {item.score}
                        </span>
                        <span className="text-xs text-zinc-400 block font-mono font-bold uppercase tracking-wider">
                          PTS
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

