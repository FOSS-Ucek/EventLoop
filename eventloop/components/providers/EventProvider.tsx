"use client";

import { createContext, useContext, useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { io, Socket } from "socket.io-client";

/* ── Types ──────────────────────────────────── */

export interface GameScoreData {
  id: string;
  userName: string;
  userImage?: string | null;
  score: number;
  linesCleared?: number;
  userId?: string | null;
}

function deduplicateLeaderboard(scores: GameScoreData[] = []): GameScoreData[] {
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

export interface GameSessionData {
  id: string;
  title: string;
  gameType: string;
  timeLimit: number;
  startedAt: string | null;
  endsAt: string | null;
  leaderboard: GameScoreData[];
}

export interface EventConfig {
  eventId: string;
  eventName: string;
  brand: {
    logoUrl: string | null;
    accentColor: string;
  };
  hypeMeter: {
    isActive: boolean;
    currentScore: number;
    startedAt: string | null;
    meter: {
      id: string;
      title: string;
      tapsNeeded: number;
      videoUrl: string;
    } | null;
  };
  gameSession?: {
    isActive: boolean;
    session: GameSessionData | null;
  };
}

export interface SessionData {
  userId: string;
  role: string;
  name: string;
  image: string;
}

interface HypeData {
  id: string;
  title: string;
  currentScore: number;
  tapsNeeded: number;
  startedAt: string | null;
  videoUrl: string;
}

interface EventContextType {
  session: SessionData | null;
  eventConfig: EventConfig | null;
  eventId: string | null;
  setEventId: (id: string | null) => void;
  isHypeActive: boolean;
  hypeData: HypeData | null;
  hypeCompleted: boolean;
  hypeStopping: boolean;
  isGameActive: boolean;
  gameData: GameSessionData | null;
  gameCompleted: boolean;
  gameStopping: boolean;
  socket: Socket | null;
  backendUrl: string;
}

const EventContext = createContext<EventContextType>({
  session: null,
  eventConfig: null,
  eventId: null,
  setEventId: () => {},
  isHypeActive: false,
  hypeData: null,
  hypeCompleted: false,
  hypeStopping: false,
  isGameActive: false,
  gameData: null,
  gameCompleted: false,
  gameStopping: false,
  socket: null,
  backendUrl: "",
});

export function useEvent() {
  return useContext(EventContext);
}

/* ── Provider ──────────────────────────────── */

export function EventProvider({
  children,
  session,
}: {
  children: ReactNode;
  session: SessionData | null;
}) {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";
  const [eventId, setEventId] = useState<string | null>(null);
  const [eventConfig, setEventConfig] = useState<EventConfig | null>(null);

  // Hype Meter state
  const [isHypeActive, setIsHypeActive] = useState(false);
  const [hypeData, setHypeData] = useState<HypeData | null>(null);
  const [hypeCompleted, setHypeCompleted] = useState(false);
  const [hypeStopping, setHypeStopping] = useState(false);

  // Game Session state
  const [isGameActive, setIsGameActive] = useState(false);
  const [gameData, setGameData] = useState<GameSessionData | null>(null);
  const [gameCompleted, setGameCompleted] = useState(false);
  const [gameStopping, setGameStopping] = useState(false);

  const socketRef = useRef<Socket | null>(null);

  // ── 1. Resolve eventId on mount ──
  useEffect(() => {
    if (typeof window === "undefined") return;

    const envEventId = process.env.NEXT_PUBLIC_EVENT_ID;
    if (envEventId) {
      setEventId(envEventId);
      return;
    }

    try {
      const stored = localStorage.getItem("activeEvent");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.id) setEventId(parsed.id);
      }
    } catch {}
  }, []);

  // ── 2. Fetch event config when eventId changes ──
  useEffect(() => {
    if (!eventId) return;

    const fetchConfig = async () => {
      try {
        const res = await fetch(`${backendUrl}/api/event/state?eventId=${eventId}`);
        const data = await res.json();
        if (data.success && data.config) {
          setEventConfig(data.config);

          // Inject brand theming
          if (data.config.brand?.accentColor && data.config.brand.accentColor !== "#ffffff") {
            const hex = data.config.brand.accentColor;
            document.documentElement.style.setProperty("--brand-accent", hex);
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            document.documentElement.style.setProperty("--brand-accent-rgb", `${r}, ${g}, ${b}`);
          }

          // Cold start: Hype meter
          if (data.config.hypeMeter?.isActive && data.config.hypeMeter.meter) {
            setIsHypeActive(true);
            setHypeData({
              id: data.config.hypeMeter.meter.id,
              title: data.config.hypeMeter.meter.title,
              currentScore: data.config.hypeMeter.currentScore,
              tapsNeeded: data.config.hypeMeter.meter.tapsNeeded,
              startedAt: data.config.hypeMeter.startedAt,
              videoUrl: data.config.hypeMeter.meter.videoUrl,
            });
          }

          // Cold start: Game session
          if (data.config.gameSession?.isActive && data.config.gameSession.session) {
            setIsGameActive(true);
            setGameData(data.config.gameSession.session);
          }
        }
      } catch (error) {
        console.error("Failed to fetch event config:", error);
      }
    };

    fetchConfig();
  }, [eventId, backendUrl]);

  // ── 3. WebSocket connection ──
  useEffect(() => {
    if (!eventId) return;

    const socket = io(backendUrl);
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("hype:join-room", { eventId });
    });

    // ── HYPE METER SOCKET EVENTS ──
    socket.on("HYPE_METER_START", (payload: any) => {
      setIsHypeActive(true);
      setHypeStopping(false);
      setHypeCompleted(false);
      setHypeData({
        id: payload.hypeMeter?.id || "",
        title: payload.hypeMeter?.title || "Hype Meter",
        currentScore: payload.initialScore || 0,
        tapsNeeded: payload.hypeMeter?.tapsNeeded || 1000,
        startedAt: payload.startedAt || null,
        videoUrl: payload.hypeMeter?.videoUrl || "",
      });
    });

    socket.on("HYPE_METER_UPDATE", (payload: any) => {
      setHypeData((prev) =>
        prev && prev.id === payload.hypeMeterId
          ? {
              ...prev,
              currentScore: payload.currentScore,
              tapsNeeded: payload.tapsNeeded ?? prev.tapsNeeded,
            }
          : prev
      );

      if (payload.currentScore >= (payload.tapsNeeded || Infinity)) {
        setHypeCompleted(true);
      }
    });

    socket.on("HYPE_METER_STOP", (payload: any) => {
      if (payload.videoUrl) {
        setHypeCompleted(true);
        setHypeData((prev) =>
          prev ? { ...prev, currentScore: payload.finalScore, videoUrl: payload.videoUrl } : prev
        );
      }
      setHypeStopping(true);
      setTimeout(() => {
        setIsHypeActive(false);
        setHypeStopping(false);
        setHypeCompleted(false);
        setHypeData(null);
      }, 600);
    });

    // ── GAME SESSION SOCKET EVENTS ──
    socket.on("GAME_START", (payload: any) => {
      if ((window as any).gameStopTimeout) {
        clearTimeout((window as any).gameStopTimeout);
        (window as any).gameStopTimeout = null;
      }
      setIsGameActive(true);
      setGameStopping(false);
      setGameCompleted(false);
      setGameData({
        id: payload.gameSession?.id || "",
        title: payload.gameSession?.title || "Event Game",
        gameType: payload.gameSession?.gameType || "dino",

        timeLimit: payload.gameSession?.timeLimit || 60,
        startedAt: payload.startedAt || payload.gameSession?.startedAt || null,
        endsAt: payload.endsAt || payload.gameSession?.endsAt || null,
        leaderboard: deduplicateLeaderboard(payload.gameSession?.leaderboard || []),
      });
    });

    socket.on("GAME_LEADERBOARD_UPDATE", (payload: any) => {
      setGameData((prev) => {
        if (!prev || prev.id !== payload.gameSessionId) return prev;
        return {
          ...prev,
          leaderboard: deduplicateLeaderboard(payload.leaderboard || prev.leaderboard),
          endsAt: payload.endsAt || prev.endsAt,
        };
      });
    });

    socket.on("GAME_STOP", (payload: any) => {
      setGameCompleted(true);
      if (payload.finalLeaderboard) {
        setGameData((prev) => (prev ? { ...prev, leaderboard: deduplicateLeaderboard(payload.finalLeaderboard) } : prev));
      }
      setGameStopping(true);
      (window as any).gameStopTimeout = setTimeout(() => {
        setIsGameActive(false);
        setGameStopping(false);
        setGameCompleted(false);
        setGameData(null);
      }, 8000); // Keep completion view open for 8s to see final standings!
    });

    socket.on("CONFIG_UPDATED", (payload: any) => {
      setEventConfig((prev) => (prev ? { ...prev, ...payload } : prev));
      if (payload.brand?.accentColor) {
        const hex = payload.brand.accentColor;
        document.documentElement.style.setProperty("--brand-accent", hex);
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        document.documentElement.style.setProperty("--brand-accent-rgb", `${r}, ${g}, ${b}`);
      }
    });

    return () => {
      socket.off("HYPE_METER_START");
      socket.off("HYPE_METER_UPDATE");
      socket.off("HYPE_METER_STOP");
      socket.off("GAME_START");
      socket.off("GAME_LEADERBOARD_UPDATE");
      socket.off("GAME_STOP");
      socket.off("CONFIG_UPDATED");
      socket.disconnect();
    };
  }, [eventId, backendUrl]);

  return (
    <EventContext.Provider
      value={{
        session,
        eventConfig,
        eventId,
        setEventId,
        isHypeActive,
        hypeData,
        hypeCompleted,
        hypeStopping,
        isGameActive,
        gameData,
        gameCompleted,
        gameStopping,
        socket: socketRef.current,
        backendUrl,
      }}
    >
      {children}
    </EventContext.Provider>
  );
}

