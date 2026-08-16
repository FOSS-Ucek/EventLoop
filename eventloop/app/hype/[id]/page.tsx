"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { io, Socket } from "socket.io-client";
import { Flame, Zap, Maximize } from "lucide-react";

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
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tapNotifications, setTapNotifications] = useState<TapNotification[]>([]);
  const [showBlackout, setShowBlackout] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

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
      currentScore: number;
      tapsNeeded?: number;
      tapper?: { name: string; image: string | null } | null;
    }) => {
      if (payload.hypeMeterId === id) {
        setMeter((prev) =>
          prev ? { ...prev, currentTaps: payload.currentScore, tapsNeeded: payload.tapsNeeded ?? prev.tapsNeeded } : prev
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

    const handleHypeCompleted = (payload: { hypeMeterId: string; videoUrl?: string; finalScore?: number }) => {
      if (!payload.hypeMeterId || payload.hypeMeterId === id) {
        setShowBlackout(true);
        setTimeout(() => {
          setMeter((prev) => (prev ? { ...prev, status: "completed", videoUrl: payload.videoUrl || prev.videoUrl, currentTaps: payload.finalScore || prev.currentTaps } : prev));
          setShowBlackout(false);
        }, 1200);
      }
    };

    const handleHypeStarted = (payload: { hypeMeter: any; initialScore?: number; startedAt?: string }) => {
      if (payload.hypeMeter?.id === id) {
        setMeter((prev) => prev ? {
          ...prev,
          id: payload.hypeMeter.id,
          title: payload.hypeMeter.title,
          tapsNeeded: payload.hypeMeter.tapsNeeded,
          videoUrl: payload.hypeMeter.videoUrl,
          currentTaps: payload.initialScore || 0,
          status: "active"
        } : prev);
      }
    };

    newSocket.on("HYPE_METER_UPDATE", handleHypeUpdate);
    newSocket.on("HYPE_METER_STOP", handleHypeCompleted);
    newSocket.on("HYPE_METER_START", handleHypeStarted);

    return () => {
      newSocket.off("HYPE_METER_UPDATE", handleHypeUpdate);
      newSocket.off("HYPE_METER_STOP", handleHypeCompleted);
      newSocket.off("HYPE_METER_START", handleHypeStarted);
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

  // Enter Fullscreen mode when video starts playing on completion
  useEffect(() => {
    if (meter?.status === "completed" && videoRef.current) {
      const el = videoRef.current as any;
      if (el.requestFullscreen) {
        el.requestFullscreen().catch(() => {});
      } else if (el.webkitRequestFullscreen) {
        el.webkitRequestFullscreen().catch(() => {});
      } else if (el.msRequestFullscreen) {
        el.msRequestFullscreen().catch(() => {});
      }
    }
  }, [meter?.status]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-zinc-800 border-t-zinc-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !meter) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-zinc-500 text-2xl font-bold">
        {error || "Hype meter not found"}
      </div>
    );
  }

  const percentage = Math.min(100, Math.round((meter.currentTaps / meter.tapsNeeded) * 100));
  const isCompleted = meter.status === "completed" || percentage >= 100;

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <div
      onClick={() => {
        if (isCompleted && videoRef.current) {
          const el = videoRef.current as any;
          if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
          else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen().catch(() => {});
        }
      }}
      className="min-h-screen bg-black text-white overflow-hidden flex flex-col items-center justify-center relative select-none w-full h-full"
    >
      {/* Native Fullscreen Button - Hidden when active in fullscreen mode or completed */}
      {!isFullscreen && !isCompleted && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleFullscreen();
          }}
          className="fixed top-6 right-6 z-[250] p-3 bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-700 text-white rounded-xl backdrop-blur-md transition-all shadow-lg flex items-center gap-2 text-xs font-semibold"
          title="Toggle Native Fullscreen"
        >
          <Maximize className="w-4 h-4" />
          <span>Fullscreen</span>
        </button>
      )}

      {/* Background gradients */}
      <div className="absolute inset-0 bg-black opacity-80" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-zinc-900 rounded-full blur-[100px]" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-zinc-900 rounded-full blur-[100px]" />

      {/* Floating Tapper Donation Popup Messages (Bottom-left overlay) */}
      <div className="fixed bottom-8 left-8 z-50 flex flex-col-reverse gap-3 max-w-sm pointer-events-none">
        {tapNotifications.map((notif) => (
          <div
            key={notif.id}
            className="flex items-center gap-3 p-3 bg-zinc-900/90 backdrop-blur-lg border border-zinc-800 rounded-2xl shadow-[0_10px_25px_rgba(0,0,0,0.5)] animate-[slideIn_0.3s_ease-out]"
          >
            {notif.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={notif.image}
                alt={notif.name}
                className="w-10 h-10 rounded-full object-cover border-2 border-zinc-700 shadow-md"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-zinc-800 text-white font-bold flex items-center justify-center border-2 border-zinc-700 shadow-md text-base">
                {notif.name.substring(0, 1).toUpperCase()}
              </div>
            )}
            <div className="flex flex-col">
              <span className="font-extrabold text-sm text-white drop-shadow-sm flex items-center gap-1">
                {notif.name} <Zap className="w-3.5 h-3.5 fill-white text-white animate-pulse" />
              </span>
              <span className="text-xs text-zinc-400 font-medium">Tapped the Hype Meter! 🔥</span>
            </div>
          </div>
        ))}
      </div>

      {/* Blackout Transition Overlay */}
      {showBlackout && (
        <div className="fixed inset-0 z-[200] bg-black animate-[fadeIn_0.5s_ease-out] flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-zinc-800 border-t-white rounded-full animate-spin" />
        </div>
      )}

      <div className="relative z-10 w-full h-full max-w-7xl px-8 flex flex-col items-center justify-center flex-1">
        {/* Header Section */}
        {!isCompleted && (
          <div className="text-center mb-16 space-y-4">
            {meter.event?.title && (
              <h2 className="text-2xl md:text-3xl font-bold tracking-widest uppercase text-zinc-500">
                {meter.event.title}
              </h2>
            )}
            <h1 className="text-6xl md:text-8xl font-black tracking-tight text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.2)]">
              {meter.title}
            </h1>
          </div>
        )}

        {isCompleted ? (
          <div className="fixed inset-0 z-[150] bg-black flex items-center justify-center animate-[fadeIn_0.8s_ease-out]">
            {meter.videoUrl ? (
              <video
                ref={videoRef}
                src={meter.videoUrl}
                autoPlay
                playsInline
                muted={false}
                className="w-full h-full object-cover border-0 outline-none"
              />
            ) : (
              <div className="w-64 h-64 rounded-full bg-zinc-900 flex items-center justify-center shadow-[0_0_100px_rgba(255,255,255,0.2)]">
                <Flame className="w-32 h-32 text-white animate-pulse" />
              </div>
            )}
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
                  stroke="#ffffff"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray="283"
                  strokeDashoffset={283 - (283 * percentage) / 100}
                  className="transition-all duration-500 ease-out"
                  style={{ filter: "drop-shadow(0 0 10px rgba(255,255,255,0.8))" }}
                />
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-7xl md:text-9xl font-black text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.5)]">
                  {percentage}%
                </span>
              </div>
            </div>

            {/* Tap Count */}
            <div className="bg-black/40 backdrop-blur-md px-12 py-6 rounded-3xl border border-white/10 shadow-2xl">
              <p className="text-4xl md:text-5xl font-mono font-bold tracking-wider text-white">
                {meter.currentTaps.toLocaleString()} <span className="text-zinc-500 text-3xl">/ {meter.tapsNeeded.toLocaleString()} TAPS</span>
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
