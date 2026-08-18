"use client";

import { useState, useCallback, memo } from "react";
import { useEvent, SessionData } from "@/components/providers/EventProvider";
import { Socket } from "socket.io-client";
import { Zap } from "lucide-react";

interface OverlayProps {
  isHypeActive: boolean;
  hypeId?: string;
  hypeCompleted: boolean;
  hypeStopping: boolean;
  socket: Socket | null;
  session: SessionData | null;
}

interface TapParticle {
  id: string;
  x: number;
  y: number;
  floatX: number;
  floatY: number;
  scale: number;
  rotation: number;
  text: string;
}

const HypeMeterOverlayContent = memo(function HypeMeterOverlayContent({
  isHypeActive,
  hypeId,
  hypeCompleted,
  hypeStopping,
  socket,
  session,
}: OverlayProps) {
  const [isTapping, setIsTapping] = useState(false);
  const [particles, setParticles] = useState<TapParticle[]>([]);

  const handleTap = useCallback(
    (e?: React.SyntheticEvent) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      if (!socket || !hypeId || hypeCompleted) return;

      setIsTapping(true);
      setTimeout(() => setIsTapping(false), 80);

      // Trigger haptic feedback on mobile devices if available
      if (typeof window !== "undefined" && window.navigator && window.navigator.vibrate) {
        try {
          window.navigator.vibrate(15);
        } catch (_) {}
      }

      // Calculate radial spawn position near center or relative to tap location
      let startX = 0;
      let startY = 0;

      const nativeEvent = e?.nativeEvent as MouseEvent | TouchEvent | undefined;
      let clientX: number | null = null;
      let clientY: number | null = null;

      if (nativeEvent) {
        if ("clientX" in nativeEvent && typeof nativeEvent.clientX === "number" && nativeEvent.clientX > 0) {
          clientX = nativeEvent.clientX;
          clientY = nativeEvent.clientY;
        } else if ("touches" in nativeEvent && nativeEvent.touches && nativeEvent.touches.length > 0) {
          clientX = nativeEvent.touches[0].clientX;
          clientY = nativeEvent.touches[0].clientY;
        } else if ("changedTouches" in nativeEvent && nativeEvent.changedTouches && nativeEvent.changedTouches.length > 0) {
          clientX = nativeEvent.changedTouches[0].clientX;
          clientY = nativeEvent.changedTouches[0].clientY;
        }
      }

      const angle = Math.random() * Math.PI * 2;

      if (clientX !== null && clientY !== null && typeof window !== "undefined") {
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        // Position near click point relative to screen center with a slight random radial scatter (20-40px)
        const scatter = 20 + Math.random() * 30;
        startX = clientX - centerX + Math.cos(angle) * scatter;
        startY = clientY - centerY + Math.sin(angle) * scatter;
      } else {
        // Random radial position around center (radius 40px to 130px)
        const radius = 40 + Math.random() * 90;
        startX = Math.cos(angle) * radius;
        startY = Math.sin(angle) * radius;
      }

      // Float outwards radially and upwards
      const floatX = Math.cos(angle) * (20 + Math.random() * 35);
      const floatY = -70 - Math.random() * 50; // Float up by 70px - 120px
      const scale = 0.9 + Math.random() * 0.45; // 0.9x to 1.35x scale
      const rotation = (Math.random() - 0.5) * 24; // -12deg to +12deg tilt

      const particleId = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const newParticle: TapParticle = {
        id: particleId,
        x: startX,
        y: startY,
        floatX,
        floatY,
        scale,
        rotation,
        text: "+1",
      };

      setParticles((prev) => [...prev.slice(-40), newParticle]);

      setTimeout(() => {
        setParticles((prev) => prev.filter((p) => p.id !== particleId));
      }, 900);

      socket.emit("hype:tap", {
        hypeMeterId: hypeId,
        user: {
          name: session?.name || "Participant",
          image: session?.image || null,
        },
      });
    },
    [socket, hypeId, hypeCompleted, session]
  );

  if (!isHypeActive || !hypeId || session?.role === "admin") return null;

  return (
    <div
      onClick={handleTap}
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden transition-all duration-500 select-none touch-manipulation cursor-pointer ${
        hypeStopping ? "animate-scale-out" : "animate-scale-in"
      }`}
      style={{ background: "#000" }}
    >
      {/* Ambient glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full blur-[150px] pointer-events-none opacity-30"
        style={{ background: "var(--brand-accent)" }}
      />

      {/* Floating Radially Spawned +1 Particles */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-50 w-0 h-0 overflow-visible">
        {particles.map((p) => (
          <span
            key={p.id}
            className="absolute select-none pointer-events-none"
            style={
              {
                left: 0,
                top: 0,
                "--x": `${p.x}px`,
                "--y": `${p.y}px`,
                "--fx": `${p.floatX}px`,
                "--fy": `${p.floatY}px`,
                "--scale": p.scale,
                "--rot": `${p.rotation}deg`,
              } as React.CSSProperties
            }
          >
            {/* Impact burst ring, tinted to the event's brand accent */}
            <span
              className="absolute rounded-full"
              style={{
                left: 0,
                top: 0,
                width: 56,
                height: 56,
                marginLeft: -28,
                marginTop: -28,
                background:
                  "radial-gradient(circle, rgba(var(--brand-accent-rgb), 0.55) 0%, rgba(var(--brand-accent-rgb), 0) 72%)",
                animation: "tapBurst 0.55s ease-out forwards",
              }}
            />
            <span
              className="absolute font-black text-4xl sm:text-6xl text-white tracking-tighter"
              style={{
                left: 0,
                top: 0,
                textShadow:
                  "0 4px 16px rgba(0, 0, 0, 0.95), 0 0 16px rgba(var(--brand-accent-rgb), 0.85), 0 0 4px rgba(255, 255, 255, 0.6)",
                WebkitTextStroke: "1.5px rgba(0, 0, 0, 0.75)",
                animation:
                  "tapFloat 0.9s cubic-bezier(0.15, 0.85, 0.35, 1.2) forwards",
              }}
            >
              {p.text}
            </span>
          </span>
        ))}
      </div>

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
            <span className="font-black text-2xl sm:text-4xl mt-2 tracking-wider">
              TAP
            </span>
          </button>
        )}
      </div>
    </div>
  );
});

export default function HypeMeterOverlay() {
  const { isHypeActive, hypeData, hypeCompleted, hypeStopping, socket, session } =
    useEvent();

  return (
    <HypeMeterOverlayContent
      isHypeActive={isHypeActive}
      hypeId={hypeData?.id}
      hypeCompleted={hypeCompleted}
      hypeStopping={hypeStopping}
      socket={socket}
      session={session}
    />
  );
}


