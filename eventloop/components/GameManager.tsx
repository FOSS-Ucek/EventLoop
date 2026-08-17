"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Gamepad2, Play, RotateCcw, Trash2, ExternalLink, Plus, AlertCircle, Check, Square, Timer } from "lucide-react";
import { useEvent, GameSessionData } from "@/components/providers/EventProvider";

interface GameManagerProps {
  eventId: string;
  backendUrl: string;
  userId?: string;
}

export default function GameManager({ eventId, backendUrl, userId }: GameManagerProps) {
  const [games, setGames] = useState<GameSessionData[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { socket } = useEvent();

  const [title, setTitle] = useState("");
  const [gameType, setGameType] = useState("dino");
  const [timeLimit, setTimeLimit] = useState(60);


  const fetchGames = async () => {
    try {
      const res = await fetch(`${backendUrl}/api/game-sessions?eventId=${eventId}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setGames(data.gameSessions || []);
      }
    } catch (err) {
      console.error("Failed to fetch game sessions", err);
    }
  };

  useEffect(() => {
    fetchGames();
  }, [eventId, backendUrl]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || timeLimit <= 0) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`${backendUrl}/api/game-sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          title,
          gameType,
          timeLimit,
          createdBy: userId,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setGames([data.gameSession, ...games]);
        setSuccess(`Game "${data.gameSession.title}" created successfully!`);
        setTitle("");
        setTimeLimit(60);
        setShowCreateForm(false);
      } else {
        setError(data.error || "Failed to create game session");
      }
    } catch (err) {
      setError("Network error while creating game session");
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (id: string, action: "activate" | "reset" | "delete" | "stop") => {
    try {
      if (action === "delete" && !confirm("Are you sure you want to delete this game session?")) return;

      const method = action === "delete" ? "DELETE" : "POST";
      const endpoint = action === "delete"
        ? `${backendUrl}/api/game-sessions/${id}`
        : `${backendUrl}/api/game-sessions/${id}/${action}`;

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();

      if (res.ok && data.success) {
        if (action === "delete") {
          setGames(games.filter((g) => g.id !== id));
        } else {
          setGames(games.map((g) => (g.id === id ? data.gameSession : g)));
        }

        if (action === "activate" && socket) {
          socket.emit("game:activate", { gameSessionId: id });
        } else if (action === "stop" && socket) {
          socket.emit("game:stop", { gameSessionId: id });
        }

        setSuccess(`Game session ${action}d successfully`);
      } else {
        setError(data.error || `Failed to ${action} game session`);
      }
    } catch (err) {
      setError(`Network error during ${action}`);
    }
  };

  return (
    <div className="mt-4 pt-4 border-t border-zinc-800 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold flex items-center gap-1.5 text-white">
          <Gamepad2 className="w-4 h-4 text-emerald-400" />
          Sub-Event Games
        </h4>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="text-xs font-medium px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-800 rounded-lg flex items-center gap-1 transition-colors min-h-[44px]"
        >
          <Plus className="w-3.5 h-3.5" />
          {showCreateForm ? "Cancel" : "Create Game"}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-black border border-zinc-700 text-white rounded-xl text-xs flex items-center gap-2 min-h-[44px]">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 text-zinc-400" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-3 bg-zinc-900 border border-zinc-800 text-white rounded-xl text-xs flex items-center gap-2 min-h-[44px]">
          <Check className="w-3.5 h-3.5 flex-shrink-0 text-zinc-400" />
          <span>{success}</span>
        </div>
      )}

      {showCreateForm && (
        <form onSubmit={handleCreate} className="p-4 bg-black border border-zinc-800 rounded-xl space-y-3">
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1 sm:col-span-1">
              <label className="block text-[10px] uppercase font-bold text-zinc-500">Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-2.5 py-1.5 text-sm border rounded-lg bg-zinc-900 border-zinc-800 text-white min-h-[44px]"
                placeholder="e.g. Dino Speed Challenge"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] uppercase font-bold text-zinc-500">Game Type</label>
              <select
                value={gameType}
                onChange={(e) => setGameType(e.target.value)}
                className="w-full px-2.5 py-1.5 text-sm border rounded-lg bg-zinc-900 border-zinc-800 text-white min-h-[44px]"
              >
                <option value="dino">Chrome Dino Runner</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] uppercase font-bold text-zinc-500">Time Limit (Seconds)</label>
              <select
                value={timeLimit}
                onChange={(e) => setTimeLimit(parseInt(e.target.value, 10))}
                className="w-full px-2.5 py-1.5 text-sm border rounded-lg bg-zinc-900 border-zinc-800 text-white min-h-[44px]"
              >
                <option value={30}>30 Seconds</option>
                <option value={60}>60 Seconds (1 min)</option>
                <option value={90}>90 Seconds (1.5 min)</option>
                <option value={120}>120 Seconds (2 min)</option>
                <option value={180}>180 Seconds (3 min)</option>
                <option value={300}>300 Seconds (5 min)</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={loading}
              className="px-3 py-1.5 bg-white hover:bg-zinc-200 text-black text-xs font-medium rounded-lg disabled:opacity-50 min-h-[44px]"
            >
              {loading ? "Saving..." : "Save Game Session"}
            </button>
          </div>
        </form>
      )}

      {games.length > 0 && (
        <div className="space-y-2">
          {games.map((g) => (
            <div key={g.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-black border border-zinc-800 rounded-xl">
              <div>
                <div className="flex items-center gap-2">
                  <h5 className="font-bold text-sm text-white">{g.title}</h5>
                  <span className="px-1.5 py-0.5 text-[9px] font-extrabold uppercase rounded bg-zinc-900 text-emerald-400 border border-zinc-800">
                    {g.gameType}
                  </span>
                  <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded uppercase ${(g as any).status === 'active' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800 animate-pulse' : (g as any).status === 'completed' ? 'bg-zinc-900 text-zinc-300 border border-zinc-700' : 'bg-black text-zinc-500 border border-zinc-800'}`}>
                    {(g as any).status}
                  </span>
                </div>
                <div className="text-xs text-zinc-500 mt-0.5 flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <Timer className="w-3 h-3 text-zinc-400" /> Time Limit: {g.timeLimit}s
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {(g as any).status === "pending" && (
                  <button
                    onClick={() => handleAction(g.id, "activate")}
                    className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                    title="Start Game Session"
                  >
                    <Play className="w-4 h-4 text-emerald-400" />
                  </button>
                )}
                {(g as any).status === "active" && (
                  <button
                    onClick={() => handleAction(g.id, "stop")}
                    className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                    title="Stop Game"
                  >
                    <Square className="w-4 h-4 text-red-400" />
                  </button>
                )}
                {((g as any).status === "active" || (g as any).status === "completed") && (
                  <button
                    onClick={() => handleAction(g.id, "reset")}
                    className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                    title="Reset Scores & Status"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                )}
                <Link
                  href={`/game/${g.id}`}
                  target="_blank"
                  className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                  title="Open Real-time Big Screen Display"
                >
                  <ExternalLink className="w-4 h-4" />
                </Link>
                <button
                  onClick={() => handleAction(g.id, "delete")}
                  className="p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                  title="Delete Game Session"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
