"use client";

import { useEvent } from "@/components/providers/EventProvider";
import { Flame, Zap } from "lucide-react";

export default function HypeMeterParticipant() {
  const { isHypeActive, hypeData, hypeCompleted } = useEvent();

  if (!isHypeActive || !hypeData) return null;

  const percentage = Math.min(100, Math.round((hypeData.currentScore / hypeData.tapsNeeded) * 100));

  return (
    <div className="mt-6 w-full p-4 md:p-6 bg-black border border-zinc-800 rounded-2xl relative overflow-hidden animate-slide-up">
      <div className="relative z-10 flex flex-col items-center space-y-4">
        <div className="text-center">
          <p className="text-sm text-zinc-400 mt-1">
            Tap on the full screen overlay to build hype!
          </p>
        </div>

        <div className="w-full max-w-sm mt-4">
          <div className="flex justify-between text-xs font-bold text-zinc-400 mb-2">
            <span>{hypeData.currentScore.toLocaleString()} TAPS</span>
            <span>{percentage}%</span>
          </div>
          <div className="w-full h-4 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
            <div
              className="h-full bg-[color:var(--brand-accent,white)] transition-all duration-300 ease-out"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>

        {hypeCompleted && (
          <div className="text-white font-bold text-lg mt-2">
            Hype Goal Reached! 🎉
          </div>
        )}
      </div>
    </div>
  );
}
