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

      <div className="relative z-10 flex flex-col items-center justify-center w-full h-full px-6">
        {hypeCompleted ? (
          /* ── Completion: Celebration Text ── */
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
          /* ── Active: TAP Button Only ── */
          <button
            onClick={handleTap}
            className={`w-56 h-56 sm:w-72 sm:h-72 rounded-full bg-white text-black flex flex-col items-center justify-center shadow-[0_0_80px_rgba(255,255,255,0.25)] active:scale-90 transition-transform duration-75 select-none touch-manipulation cursor-pointer ${
              isTapping ? "scale-90" : "scale-100"
            }`}
            style={{
              animation: "hype-pulse 2s infinite",
            }}
          >
            <Zap
              className={`w-20 h-20 sm:w-24 sm:h-24 transition-transform fill-black ${
                isTapping ? "scale-125" : ""
              }`}
            />
            <span className="font-black text-2xl sm:text-4xl mt-2 tracking-wider">TAP</span>
          </button>
        )}
      </div>
    </div>
  );
}

