"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useEvent } from "@/components/providers/EventProvider";
import DinoGame from "@/components/DinoGame";
import { Timer, Gamepad2, Crown } from "lucide-react";

export default function GameOverlay() {
  const { isGameActive, gameData, gameCompleted, gameStopping, socket, session } = useEvent();
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  // Live countdown timer calculation based on endsAt
  useEffect(() => {
    if (!isGameActive || !gameData?.endsAt) return;

    const updateTimer = () => {
      const endsTime = new Date(gameData.endsAt!).getTime();
      const now = Date.now();
      const diffSec = Math.max(0, Math.ceil((endsTime - now) / 1000));
      setRemainingSeconds(diffSec);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 500);
    return () => clearInterval(interval);
  }, [isGameActive, gameData]);
  const lastEmitRef = useRef<number>(0);

  const handleScoreUpdate = useCallback(
    (score: number, distanceRun: number, isGameOver: boolean = false) => {
      if (!socket || !gameData?.id) return;

      const now = Date.now();
      // Throttle to once every 1000ms, UNLESS it's game over (fail) to ensure final score is captured
      if (!isGameOver && now - lastEmitRef.current < 1000) return;
      lastEmitRef.current = now;

      socket.emit("game:score-update", {
        gameSessionId: gameData.id,
        userId: session?.userId || null,
        userName: session?.name || "Participant",
        userImage: session?.image || null,
        score,
        linesCleared: distanceRun,
      });
    },
    [socket, gameData?.id, session]
  );

  // When game is active...
  if (!isGameActive || !gameData || session?.role === "admin") return null;

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const formattedTime = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

  // Countdown timer urgency color logic
  const timerColor =
    remainingSeconds <= 10
      ? "text-red-500 border-red-500/50 bg-red-950/50 animate-pulse"
      : remainingSeconds <= 30
      ? "text-amber-400 border-amber-500/40 bg-amber-950/40"
      : "text-emerald-400 border-emerald-500/40 bg-emerald-950/40";

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col bg-black transition-all duration-500 ${
        gameStopping ? "animate-scale-out" : "animate-scale-in"
      }`}
    >
      {/* Compact Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/60 bg-black/80 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
            <Gamepad2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-white leading-tight">{gameData.title}</h3>
            <span className="text-[10px] text-zinc-500 font-semibold uppercase">Live Tournament</span>
          </div>
        </div>

        {/* Countdown Clock */}
        <div className={`flex items-center gap-2 px-3.5 py-1.5 border rounded-xl font-mono text-base font-black transition-colors ${timerColor}`}>
          <Timer className="w-4 h-4" />
          <span>{formattedTime}</span>
        </div>
      </div>

      {/* Full-screen Game Area */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
        {gameCompleted ? (
          <div className="text-center space-y-4 animate-scale-in">
            <Crown className="w-16 h-16 text-amber-400 mx-auto animate-bounce" />
            <h2 className="text-3xl font-black text-white">TIME&apos;S UP!</h2>
            <p className="text-sm text-zinc-400 max-w-sm mx-auto">
              Check the big screen for the final leaderboard and winners! 🏆
            </p>
          </div>
        ) : (
          <div className="w-full max-w-2xl">
            <DinoGame onScoreUpdate={handleScoreUpdate} disabled={remainingSeconds <= 0} />
          </div>
        )}
      </div>
    </div>
  );
}
