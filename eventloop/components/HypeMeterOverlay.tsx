"use client";

import { useState, useCallback } from "react";
import { useEvent } from "@/components/providers/EventProvider";
import { Zap } from "lucide-react";

export default function HypeMeterOverlay() {
  const { isHypeActive, hypeData, hypeCompleted, hypeStopping, socket, session } = useEvent();
  const [isTapping, setIsTapping] = useState(false);

  const handleTap = useCallback(() => {
    if (!socket || !hypeData || hypeCompleted) return;

    setIsTapping(true);
    setTimeout(() => setIsTapping(false), 80);

    socket.emit("hype:tap", {
      hypeMeterId: hypeData.id,
      user: {
        name: session?.name || "Participant",
        image: session?.image || null,
      },
    });
  }, [socket, hypeData, hypeCompleted, session]);

  if (!isHypeActive || !hypeData || session?.role === "admin") return null;

  const percentage = Math.min(
    100,
    Math.round((hypeData.currentScore / hypeData.tapsNeeded) * 100)
  );
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (circumference * percentage) / 100;

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden transition-all duration-500 ${
        hypeStopping ? "animate-scale-out" : "animate-scale-in"
      }`}
      style={{ background: "#000" }}
    >
      {/* Ambient glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full blur-[150px] pointer-events-none opacity-30"
        style={{ background: "var(--brand-accent)" }}
      />

      <div className="relative z-10 flex flex-col items-center w-full max-w-lg px-6">
        {/* Title */}
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white text-center mb-8 animate-slide-up">
          {hypeData.title}
        </h1>

        {hypeCompleted ? (
          /* ── Completion: Celebration Text (No Video on Mobile) ── */
          <div className="w-full space-y-6 text-center animate-scale-in">
            <div className="w-24 h-24 mx-auto rounded-full bg-white/10 border border-white/20 flex items-center justify-center animate-float">
              <Zap className="w-12 h-12 text-white fill-white" />
            </div>
            <h2 className="text-3xl font-black text-white tracking-tight">
              HYPE GOAL UNLOCKED!
            </h2>
            <p className="text-sm text-zinc-400">
              Look up at the main event screen for the video reveal! 🎬
            </p>
          </div>
        ) : (
          /* ── Active: Tap Interface ── */
          <>
            {/* Circular Progress */}
            <div className="relative w-48 h-48 sm:w-64 sm:h-64 mb-8">
              <svg
                className="w-full h-full -rotate-90"
                viewBox="0 0 100 100"
              >
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth="5"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="var(--brand-accent)"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  className="transition-all duration-300 ease-out"
                  style={{
                    filter: `drop-shadow(0 0 8px rgba(var(--brand-accent-rgb), 0.6))`,
                  }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-5xl sm:text-7xl font-black text-white tabular-nums">
                  {percentage}
                </span>
                <span className="text-sm text-zinc-500 font-medium -mt-1">%</span>
              </div>
            </div>

            {/* TAP Button */}
            <button
              onClick={handleTap}
              className={`w-36 h-36 sm:w-44 sm:h-44 rounded-full bg-white text-black flex flex-col items-center justify-center shadow-[0_0_60px_rgba(var(--brand-accent-rgb),0.15)] active:scale-90 transition-transform duration-75 ${
                isTapping ? "scale-90" : "scale-100"
              }`}
              style={{
                animation: "hype-pulse 2s infinite",
              }}
            >
              <Zap
                className={`w-10 h-10 sm:w-12 sm:h-12 transition-transform ${
                  isTapping ? "scale-125" : ""
                }`}
              />
              <span className="font-black text-lg sm:text-xl mt-1">TAP</span>
            </button>

            {/* Score */}
            <div className="mt-8 text-center">
              <p className="text-2xl sm:text-3xl font-mono font-bold text-white tabular-nums">
                {hypeData.currentScore.toLocaleString()}
                <span className="text-zinc-600 text-lg sm:text-xl ml-2">
                  / {hypeData.tapsNeeded.toLocaleString()}
                </span>
              </p>
              <p className="text-xs text-zinc-600 mt-1 uppercase tracking-wider font-semibold">
                taps
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
