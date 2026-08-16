"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Flame, Zap, Play, RotateCcw, Trash2, ExternalLink, Plus, AlertCircle, Check, Square } from "lucide-react";
import { useEvent } from "@/components/providers/EventProvider";

interface HypeMeterItem {
  id: string;
  title: string;
  eventId: string;
  tapsNeeded: number;
  currentTaps: number;
  videoUrl?: string;
  status: "pending" | "active" | "completed";
  createdAt: string;
}

interface HypeMeterManagerProps {
  eventId: string;
  backendUrl: string;
  userId?: string;
}

export default function HypeMeterManager({ eventId, backendUrl, userId }: HypeMeterManagerProps) {
  const [hypeMeters, setHypeMeters] = useState<HypeMeterItem[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { socket } = useEvent();

  const [title, setTitle] = useState("");
  const [tapsNeeded, setTapsNeeded] = useState(1000);
  const [videoUrl, setVideoUrl] = useState("");

  const fetchHypeMeters = async () => {
    try {
      const res = await fetch(`${backendUrl}/api/hype-meters?eventId=${eventId}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setHypeMeters(data.hypeMeters || []);
      }
    } catch (err) {
      console.error("Failed to fetch hype meters", err);
    }
  };

  useEffect(() => {
    fetchHypeMeters();
  }, [eventId, backendUrl]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || tapsNeeded <= 0) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`${backendUrl}/api/hype-meters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          title,
          tapsNeeded,
          videoUrl,
          userId,
          createdBy: userId,
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setHypeMeters([data.hypeMeter, ...hypeMeters]);
        setSuccess("Hype Meter created successfully!");
        setTitle("");
        setTapsNeeded(1000);
        setVideoUrl("");
        setShowCreateForm(false);
      } else {
        setError(data.error || "Failed to create hype meter");
      }
    } catch (err) {
      setError("Network error while creating hype meter");
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (id: string, action: "activate" | "reset" | "delete" | "stop") => {
    try {
      if (action === "delete" && !confirm("Are you sure you want to delete this hype meter?")) return;

      const method = action === "delete" ? "DELETE" : "POST";
      const endpoint = action === "delete"
        ? `${backendUrl}/api/hype-meters/${id}?userId=${userId}`
        : `${backendUrl}/api/hype-meters/${id}/${action}`;

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: method === "POST" ? JSON.stringify({ userId, createdBy: userId }) : undefined,
      });
      const data = await res.json();

      if (res.ok && data.success) {
        if (action === "delete") {
          setHypeMeters(hypeMeters.filter(h => h.id !== id));
        } else {
          setHypeMeters(hypeMeters.map(h => h.id === id ? data.hypeMeter : h));
        }
        
        if (action === "stop" && socket) {
          socket.emit("hype:stop", { hypeMeterId: id });
        }
        
        setSuccess(`Hype Meter ${action}d successfully`);
      } else {
        setError(data.error || `Failed to ${action} hype meter`);
      }
    } catch (err) {
      setError(`Network error during ${action}`);
    }
  };

  return (
    <div className="mt-4 pt-4 border-t border-zinc-800 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold flex items-center gap-1.5 text-white">
          <Flame className="w-4 h-4" />
          Hype Meters
        </h4>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="text-xs font-medium px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-800 rounded-lg flex items-center gap-1 transition-colors min-h-[44px]"
        >
          <Plus className="w-3.5 h-3.5" />
          {showCreateForm ? "Cancel" : "Create"}
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
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-[10px] uppercase font-bold text-zinc-500">Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-2.5 py-1.5 text-sm border rounded-lg bg-zinc-900 border-zinc-800 text-white min-h-[44px]"
                placeholder="e.g. Boss Fight"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] uppercase font-bold text-zinc-500">Taps Needed</label>
              <input
                type="number"
                required
                min="1"
                value={tapsNeeded}
                onChange={(e) => setTapsNeeded(parseInt(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 text-sm border rounded-lg bg-zinc-900 border-zinc-800 text-white min-h-[44px]"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="block text-[10px] uppercase font-bold text-zinc-500">Video URL *</label>
            <input
              type="url"
              required
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              className="w-full px-2.5 py-1.5 text-sm border rounded-lg bg-zinc-900 border-zinc-800 text-white min-h-[44px]"
              placeholder="e.g. https://example.com/video.mp4"
            />
          </div>
          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={loading}
              className="px-3 py-1.5 bg-white hover:bg-zinc-200 text-black text-xs font-medium rounded-lg disabled:opacity-50 min-h-[44px]"
            >
              {loading ? "Saving..." : "Save Hype Meter"}
            </button>
          </div>
        </form>
      )}

      {hypeMeters.length > 0 && (
        <div className="space-y-2">
          {hypeMeters.map((meter) => (
            <div key={meter.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-black border border-zinc-800 rounded-xl">
              <div>
                <div className="flex items-center gap-2">
                  <h5 className="font-bold text-sm text-white">{meter.title}</h5>
                  <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded uppercase ${meter.status === 'active' ? 'bg-zinc-800 text-white border border-zinc-700' : meter.status === 'completed' ? 'bg-zinc-900 text-zinc-300 border border-zinc-700' : 'bg-black text-zinc-500 border border-zinc-800'}`}>
                    {meter.status}
                  </span>
                </div>
                <div className="text-xs text-zinc-500 mt-0.5 flex items-center gap-2">
                  <span className="flex items-center gap-1"><Zap className="w-3 h-3 text-zinc-400" /> {meter.currentTaps} / {meter.tapsNeeded}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {meter.status === "pending" && (
                  <button
                    onClick={() => handleAction(meter.id, "activate")}
                    className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                    title="Activate"
                  >
                    <Play className="w-4 h-4" />
                  </button>
                )}
                {meter.status === "active" && (
                  <button
                    onClick={() => handleAction(meter.id, "stop")}
                    className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                    title="Stop"
                  >
                    <Square className="w-4 h-4" />
                  </button>
                )}
                {(meter.status === "active" || meter.status === "completed") && (
                  <button
                    onClick={() => handleAction(meter.id, "reset")}
                    className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                    title="Reset"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                )}
                <Link
                  href={`/hype/${meter.id}`}
                  target="_blank"
                  className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                  title="View Display Screen"
                >
                  <ExternalLink className="w-4 h-4" />
                </Link>
                <button
                  onClick={() => handleAction(meter.id, "delete")}
                  className="p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                  title="Delete"
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
