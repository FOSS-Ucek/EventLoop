"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { io, Socket } from "socket.io-client";
import { Flame, Zap } from "lucide-react";

interface HypeMeterData {
  id: string;
  eventId: string;
  title: string;
  tapsNeeded: number;
  currentTaps: number;
  videoUrl: string;
  status: string;
  event?: { title: string };
}

interface TapNotification {
  id: string;
  name: string;
  image: string | null;
  time: number;
}

export default function HypeMeterScreen() {
  const { id } = useParams();
  const [meter, setMeter] = useState<HypeMeterData | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tapNotifications, setTapNotifications] = useState<TapNotification[]>([]);

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

  useEffect(() => {
    if (!id) return;

    // Connect to socket once
    const newSocket = io(backendUrl);
    socketRef.current = newSocket;

    const fetchMeter = async () => {
      try {
        const res = await fetch(`${backendUrl}/api/hype-meter/${id}`);
        const data = await res.json();

        if (res.ok && data.success) {
          setMeter(data.hypeMeter);
          if (newSocket.connected) {
            newSocket.emit("hype:join-room", { eventId: data.hypeMeter.eventId });
          } else {
            newSocket.once("connect", () => {
              newSocket.emit("hype:join-room", { eventId: data.hypeMeter.eventId });
            });
          }
        } else {
          setError(data.error || "Hype meter not found");
        }
      } catch (err) {
        setError("Network error fetching hype meter");
      } finally {
        setLoading(false);
      }
    };

    fetchMeter();

    const handleHypeUpdate = (payload: {
      hypeMeterId: string;
      currentTaps: number;
      tapsNeeded: number;
      percentage: number;
      tapper?: { name: string; image: string | null } | null;
    }) => {
      if (payload.hypeMeterId === id) {
        setMeter((prev) =>
          prev ? { ...prev, currentTaps: payload.currentTaps, tapsNeeded: payload.tapsNeeded } : prev
        );

        if (payload.tapper) {
          const notif: TapNotification = {
            id: Math.random().toString(36).substring(2, 9),
            name: payload.tapper.name || "Participant",
            image: payload.tapper.image,
            time: Date.now(),
          };

          setTapNotifications((prev) => [notif, ...prev].slice(0, 5));
        }
      }
    };

    const handleHypeCompleted = (payload: { hypeMeterId: string; videoUrl: string }) => {
      if (payload.hypeMeterId === id) {
        setMeter((prev) => (prev ? { ...prev, status: "completed", videoUrl: payload.videoUrl } : prev));
      }
    };

    const handleHypeStarted = (payload: { hypeMeter: HypeMeterData }) => {
      if (payload.hypeMeter.id === id) {
        setMeter(payload.hypeMeter);
      }
    };

    newSocket.on("hype:update", handleHypeUpdate);
    newSocket.on("hype:completed", handleHypeCompleted);
    newSocket.on("hype:started", handleHypeStarted);

    return () => {
      newSocket.off("hype:update", handleHypeUpdate);
      newSocket.off("hype:completed", handleHypeCompleted);
      newSocket.off("hype:started", handleHypeStarted);
      newSocket.disconnect();
    };
  }, [id, backendUrl]);

  // Clean up notifications after 4 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setTapNotifications((prev) => prev.filter((n) => now - n.time < 4000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !meter) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-red-500 text-2xl font-bold">
        {error || "Hype meter not found"}
      </div>
    );
  }

  const percentage = Math.min(100, Math.round((meter.currentTaps / meter.tapsNeeded) * 100));
  const isCompleted = meter.status === "completed" || percentage >= 100;

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden flex flex-col items-center justify-center relative select-none">
      {/* Background gradients */}
      <div className="absolute inset-0 bg-gradient-to-br from-violet-950 via-purple-900 to-indigo-950 opacity-80" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/30 rounded-full blur-[100px]" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/30 rounded-full blur-[100px]" />

      {/* Floating Tapper Donation Popup Messages (Bottom-left overlay) */}
      <div className="fixed bottom-8 left-8 z-50 flex flex-col-reverse gap-3 max-w-sm pointer-events-none">
        {tapNotifications.map((notif) => (
          <div
            key={notif.id}
            className="flex items-center gap-3 p-3 bg-gradient-to-r from-orange-500/90 via-pink-600/90 to-purple-600/90 backdrop-blur-lg border border-white/20 rounded-2xl shadow-[0_10px_25px_rgba(0,0,0,0.5)] animate-[slideIn_0.3s_ease-out]"
          >
            {notif.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={notif.image}
                alt={notif.name}
                className="w-10 h-10 rounded-full object-cover border-2 border-white/80 shadow-md"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-orange-400 text-white font-bold flex items-center justify-center border-2 border-white/80 shadow-md text-base">
                {notif.name.substring(0, 1).toUpperCase()}
              </div>
            )}
            <div className="flex flex-col">
              <span className="font-extrabold text-sm text-white drop-shadow-sm flex items-center gap-1">
                {notif.name} <Zap className="w-3.5 h-3.5 fill-yellow-300 text-yellow-300 animate-pulse" />
              </span>
              <span className="text-xs text-orange-100 font-medium">Tapped the Hype Meter! 🔥</span>
            </div>
          </div>
        ))}
      </div>

      <div className="relative z-10 w-full max-w-7xl px-8 flex flex-col items-center">
        {/* Header Section */}
        <div className="text-center mb-16 space-y-4">
          {meter.event?.title && (
            <h2 className="text-2xl md:text-3xl font-bold tracking-widest uppercase text-indigo-300">
              {meter.event.title}
            </h2>
          )}
          <h1 className="text-6xl md:text-8xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-400 drop-shadow-[0_0_30px_rgba(167,139,250,0.5)]">
            {meter.title}
          </h1>
        </div>

        {isCompleted ? (
          <div className="w-full flex flex-col items-center animate-[fadeIn_1s_ease-out]">
            <h2 className="text-5xl font-black text-green-400 mb-8 animate-bounce drop-shadow-[0_0_20px_rgba(74,222,128,0.8)]">
              🎉 HYPE GOAL REACHED! 🎉
            </h2>
            {meter.videoUrl ? (
              <div className="w-full max-w-5xl aspect-video rounded-3xl overflow-hidden shadow-[0_0_100px_rgba(139,92,246,0.6)] border-4 border-purple-500/50">
                <video
                  src={meter.videoUrl}
                  autoPlay
                  controls
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="w-64 h-64 rounded-full bg-gradient-to-tr from-green-400 to-emerald-600 flex items-center justify-center shadow-[0_0_100px_rgba(52,211,153,0.8)]">
                <Flame className="w-32 h-32 text-white animate-pulse" />
              </div>
            )}

            {/* Celebration particles */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {[...Array(20)].map((_, i) => (
                <div
                  key={i}
                  className="absolute w-3 h-3 rounded-full animate-[particle_3s_ease-out_infinite]"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: `${50 + Math.random() * 20}%`,
                    backgroundColor: ["#a855f7", "#6366f1", "#4ade80", "#facc15"][Math.floor(Math.random() * 4)],
                    animationDelay: `${Math.random() * 2}s`,
                  }}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            {/* Massive Circular Progress indicator */}
            <div className="relative w-[300px] h-[300px] md:w-[500px] md:h-[500px] flex items-center justify-center mb-12">
              <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
                {/* Background track */}
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="rgba(255,255,255,0.1)"
                  strokeWidth="8"
                />
                {/* Progress track */}
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="url(#gradient)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray="283"
                  strokeDashoffset={283 - (283 * percentage) / 100}
                  className="transition-all duration-500 ease-out"
                  style={{ filter: "drop-shadow(0 0 10px rgba(167,139,250,0.8))" }}
                />
                <defs>
                  <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#a855f7" />
                    <stop offset="100%" stopColor="#6366f1" />
                  </linearGradient>
                </defs>
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-7xl md:text-9xl font-black text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.5)]">
                  {percentage}%
                </span>
              </div>
            </div>

            {/* Tap Count */}
            <div className="bg-black/40 backdrop-blur-md px-12 py-6 rounded-3xl border border-white/10 shadow-2xl">
              <p className="text-4xl md:text-5xl font-mono font-bold tracking-wider text-purple-200">
                {meter.currentTaps.toLocaleString()} <span className="text-indigo-400/70 text-3xl">/ {meter.tapsNeeded.toLocaleString()} TAPS</span>
              </p>
            </div>
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(20px) scale(0.8); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes particle {
          0% { transform: translateY(0) scale(1); opacity: 1; }
          100% { transform: translateY(-200px) scale(0); opacity: 0; }
        }
      `}} />
    </div>
  );
}
