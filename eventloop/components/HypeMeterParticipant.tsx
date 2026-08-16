"use client";

import { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { Flame, Zap } from "lucide-react";

interface ActiveMeter {
  id: string;
  eventId: string;
  title: string;
  tapsNeeded: number;
  currentTaps: number;
  videoUrl: string;
  status: string;
}

interface HypeMeterParticipantProps {
  eventId: string;
  backendUrl: string;
  userProfile?: {
    id?: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  } | null;
}

export default function HypeMeterParticipant({ eventId, backendUrl, userProfile }: HypeMeterParticipantProps) {
  const [activeMeter, setActiveMeter] = useState<ActiveMeter | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const [isTapping, setIsTapping] = useState(false);

  useEffect(() => {
    // Initial fetch to see if there is an active meter
    const fetchActiveMeter = async () => {
      try {
        const res = await fetch(`${backendUrl}/api/hype-meters?eventId=${eventId}`);
        const data = await res.json();
        if (res.ok && data.success) {
          const active = data.hypeMeters?.find((m: ActiveMeter) => m.status === "active" || m.status === "completed");
          if (active) {
            setActiveMeter(active);
          }
        }
      } catch (err) {
        console.error("Failed to fetch active hype meter", err);
      }
    };
    fetchActiveMeter();

    // Socket connection
    const newSocket = io(backendUrl);
    socketRef.current = newSocket;

    newSocket.on("connect", () => {
      newSocket.emit("hype:join-room", { eventId });
    });

    newSocket.on("hype:started", (payload: { hypeMeter: ActiveMeter }) => {
      setActiveMeter(payload.hypeMeter);
    });

    newSocket.on("hype:update", (payload: { hypeMeterId: string; currentTaps: number; tapsNeeded: number; percentage: number }) => {
      setActiveMeter((prev) =>
        prev && prev.id === payload.hypeMeterId
          ? { ...prev, currentTaps: payload.currentTaps, tapsNeeded: payload.tapsNeeded }
          : prev
      );
    });

    newSocket.on("hype:completed", (payload: { hypeMeterId: string; videoUrl: string }) => {
      setActiveMeter((prev) =>
        prev && prev.id === payload.hypeMeterId
          ? { ...prev, status: "completed", videoUrl: payload.videoUrl }
          : prev
      );
    });

    return () => {
      newSocket.disconnect();
    };
  }, [eventId, backendUrl]);

  const handleTap = () => {
    if (!activeMeter || activeMeter.status === "completed" || !socketRef.current) return;

    // Add visual tap effect
    setIsTapping(true);
    setTimeout(() => setIsTapping(false), 100);

    // Optimistically update
    setActiveMeter((prev) =>
      prev ? { ...prev, currentTaps: Math.min(prev.currentTaps + 1, prev.tapsNeeded) } : prev
    );

    // Emit event with tapper user profile details
    socketRef.current.emit("hype:tap", {
      hypeMeterId: activeMeter.id,
      user: {
        name: userProfile?.name || "Participant",
        image: userProfile?.image || null,
      },
    });
  };

  if (!activeMeter) return null;

  const percentage = Math.min(100, Math.round((activeMeter.currentTaps / activeMeter.tapsNeeded) * 100));
  const isCompleted = activeMeter.status === "completed" || percentage >= 100;

  return (
    <div className="mt-6 w-full p-4 md:p-6 bg-gradient-to-b from-orange-900/40 to-red-950/60 border border-orange-500/30 rounded-2xl relative overflow-hidden">
      {/* Glow effect in background */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-orange-500/20 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center space-y-4">
        <div className="text-center">
          <h3 className="text-xl font-bold text-orange-100 flex items-center justify-center gap-2">
            <Flame className="w-5 h-5 text-orange-500" />
            {activeMeter.title}
          </h3>
          <p className="text-sm text-orange-200/80 mt-1">
            Tap to build hype! Let&apos;s reach {activeMeter.tapsNeeded.toLocaleString()} taps!
          </p>
        </div>

        {isCompleted && activeMeter.videoUrl ? (
          <div className="w-full max-w-md aspect-video bg-black rounded-xl overflow-hidden shadow-2xl ring-2 ring-orange-500/50">
            <video
              src={activeMeter.videoUrl}
              autoPlay
              controls
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <>
            <button
              onClick={handleTap}
              disabled={isCompleted}
              className={`w-32 h-32 md:w-40 md:h-40 rounded-full bg-gradient-to-br from-orange-500 to-red-600 shadow-[0_0_40px_rgba(249,115,22,0.4)] flex flex-col items-center justify-center border-4 border-orange-300/30 transition-all duration-75 active:scale-95 ${isTapping ? 'scale-95 brightness-125' : 'scale-100'} ${isCompleted ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:shadow-[0_0_60px_rgba(249,115,22,0.6)]'}`}
              style={{
                animation: isCompleted ? 'none' : 'pulse-glow 2s infinite'
              }}
            >
              <Zap className={`w-12 h-12 text-white ${isTapping ? 'scale-110' : 'scale-100'} transition-transform`} />
              <span className="text-white font-bold mt-1 text-lg">TAP!</span>
            </button>

            <div className="w-full max-w-sm mt-6">
              <div className="flex justify-between text-xs font-bold text-orange-200 mb-2">
                <span>{activeMeter.currentTaps.toLocaleString()} TAPS</span>
                <span>{percentage}%</span>
              </div>
              <div className="w-full h-4 bg-black/50 rounded-full overflow-hidden border border-orange-900/50">
                <div
                  className="h-full bg-gradient-to-r from-orange-500 to-yellow-400 transition-all duration-300 ease-out relative"
                  style={{ width: `${percentage}%` }}
                >
                  <div className="absolute inset-0 bg-white/20 w-full h-full animate-[shimmer_2s_infinite]" />
                </div>
              </div>
            </div>

            {isCompleted && (
              <div className="text-green-400 font-bold text-lg animate-bounce mt-4">
                Hype Goal Reached! 🎉
              </div>
            )}
          </>
        )}
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 40px rgba(249,115,22,0.4); }
          50% { box-shadow: 0 0 60px rgba(249,115,22,0.7), 0 0 20px rgba(239,68,68,0.5) inset; }
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}} />
    </div>
  );
}
