"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, QrCode, Trash2, Calendar, MapPin, Check, AlertCircle, Sparkles, Users } from "lucide-react";
import HypeMeterManager from "@/components/HypeMeterManager";

export interface ParticipantItem {
  id?: string;
  joinedAt?: string;
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

export interface EventItem {
  id: string;
  title: string;
  description?: string | null;
  location?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  code: string;
  status: string;
  createdAt: string;
  participants?: ParticipantItem[];
}

interface AdminEventsManagerProps {
  initialEvents: EventItem[];
  backendUrl: string;
  userId?: string;
}

export default function AdminEventsManager({
  initialEvents,
  backendUrl,
  userId,
}: AdminEventsManagerProps) {
  const [events, setEvents] = useState<EventItem[]>(initialEvents);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form states
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [startDate, setStartDate] = useState("");
  const [code, setCode] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [accentColor, setAccentColor] = useState("");

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Event title is required");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`${backendUrl}/api/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          location,
          startDate: startDate || null,
          code: code.trim() || undefined,
          createdBy: userId,
          logoUrl: logoUrl.trim() || undefined,
          accentColor: accentColor.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success && data.event) {
        setEvents([{ ...data.event, participants: [] }, ...events]);
        setSuccess(`Event "${data.event.title}" created successfully! Code: ${data.event.code}`);
        setTitle("");
        setDescription("");
        setLocation("");
        setStartDate("");
        setCode("");
        setLogoUrl("");
        setAccentColor("");
        setShowCreateForm(false);
      } else {
        setError(data.error || "Failed to create event");
      }
    } catch (err: any) {
      console.error("Create event error:", err);
      setError("Network or server error while creating event");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEvent = async (id: string) => {
    if (!confirm("Are you sure you want to delete this event?")) return;

    try {
      const res = await fetch(`${backendUrl}/api/events/${id}?userId=${userId}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setEvents(events.filter((e) => e.id !== id));
        setSuccess("Event deleted successfully");
      } else {
        setError(data.error || "Failed to delete event");
      }
    } catch (err) {
      console.error("Delete event error:", err);
      setError("Failed to delete event");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
        <div>
          <h2 className="text-xl font-bold">Event Management</h2>
          <p className="text-sm text-zinc-500">Create events, generate QR codes, and track joined participants</p>
        </div>
        <button
          onClick={() => {
            setShowCreateForm(!showCreateForm);
            setError(null);
          }}
          className="py-2 px-4 bg-white hover:bg-zinc-200 text-black text-sm font-medium rounded-xl shadow-sm flex items-center gap-2 transition-all min-h-[44px]"
        >
          <Plus className="w-4 h-4" />
          {showCreateForm ? "Cancel" : "Create New Event"}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-black border border-zinc-700 text-white rounded-xl text-sm flex items-center gap-2 min-h-[44px]">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-zinc-400" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 bg-zinc-900 border border-zinc-800 text-white rounded-xl text-sm flex items-center gap-2 min-h-[44px]">
          <Check className="w-4 h-4 flex-shrink-0 text-zinc-400" />
          <span>{success}</span>
        </div>
      )}

      {/* Create Event Form */}
      {showCreateForm && (
        <form
          onSubmit={handleCreateEvent}
          className="p-6 glass border border-zinc-800 rounded-2xl shadow-sm space-y-4 transition-all"
        >
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-white" />
            Create New Event
          </h3>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="event-title" className="block text-xs font-semibold text-zinc-400">
                Event Title *
              </label>
              <input
                id="event-title"
                type="text"
                required
                placeholder="e.g. Tech Summit 2026"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3.5 py-2 border rounded-xl text-sm bg-black border-zinc-800 text-white focus:outline-none focus:border-zinc-500 min-h-[44px]"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="event-code" className="block text-xs font-semibold text-zinc-400">
                Custom Event Code (Optional)
              </label>
              <input
                id="event-code"
                type="text"
                placeholder="Auto-generated if left blank"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full px-3.5 py-2 border rounded-xl text-sm bg-black border-zinc-800 text-white focus:outline-none focus:border-zinc-500 font-mono min-h-[44px]"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="event-location" className="block text-xs font-semibold text-zinc-400">
                Location
              </label>
              <input
                id="event-location"
                type="text"
                placeholder="e.g. Main Auditorium / Online"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-3.5 py-2 border rounded-xl text-sm bg-black border-zinc-800 text-white focus:outline-none focus:border-zinc-500 min-h-[44px]"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="event-start-date" className="block text-xs font-semibold text-zinc-400">
                Start Date & Time
              </label>
              <input
                id="event-start-date"
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3.5 py-2 border rounded-xl text-sm bg-black border-zinc-800 text-white focus:outline-none focus:border-zinc-500 min-h-[44px] [color-scheme:dark]"
              />
            </div>
            
            <div className="space-y-1">
              <label htmlFor="event-logo-url" className="block text-xs font-semibold text-zinc-400">
                Logo URL (Optional)
              </label>
              <input
                id="event-logo-url"
                type="text"
                placeholder="https://example.com/logo.png"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                className="w-full px-3.5 py-2 border rounded-xl text-sm bg-black border-zinc-800 text-white focus:outline-none focus:border-zinc-500 min-h-[44px]"
              />
            </div>
            
            <div className="space-y-1">
              <label htmlFor="event-accent-color" className="block text-xs font-semibold text-zinc-400">
                Accent Color (Optional)
              </label>
              <div className="flex gap-2">
                <input
                  id="event-accent-color-picker"
                  type="color"
                  value={accentColor || "#ffffff"}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="w-11 h-11 p-1 border rounded-xl bg-black border-zinc-800 min-h-[44px]"
                />
                <input
                  id="event-accent-color"
                  type="text"
                  placeholder="#ffffff"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="flex-1 px-3.5 py-2 border rounded-xl text-sm bg-black border-zinc-800 text-white focus:outline-none focus:border-zinc-500 font-mono min-h-[44px]"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="event-description" className="block text-xs font-semibold text-zinc-400">
              Description
            </label>
            <textarea
              id="event-description"
              rows={3}
              placeholder="Brief description of the event..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 border rounded-xl text-sm bg-black border-zinc-800 text-white focus:outline-none focus:border-zinc-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="px-4 py-2 text-sm border border-zinc-800 rounded-xl hover:bg-zinc-800 min-h-[44px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-white hover:bg-zinc-200 text-black font-medium text-sm rounded-xl shadow-sm disabled:opacity-50 transition-colors min-h-[44px]"
            >
              {loading ? "Creating..." : "Save Event"}
            </button>
          </div>
        </form>
      )}

      {/* Events List */}
      <div className="glass border border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-zinc-800 bg-black/40 flex justify-between items-center">
          <h3 className="font-semibold text-sm">Created Events ({events.length})</h3>
        </div>

        {events.length === 0 ? (
          <div className="p-8 text-center text-zinc-500 text-sm">
            No events found. Click &quot;Create New Event&quot; above to create your first event.
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {events.map((evt) => {
              const participantCount = evt.participants?.length || 0;
              return (
                <div
                  key={evt.id}
                  className="p-4 space-y-3 hover:bg-zinc-800/30 transition-colors"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-base">{evt.title}</h4>
                        <span className="px-2 py-0.5 text-xs font-mono rounded bg-black text-zinc-300 border border-zinc-700">
                          Code: {evt.code}
                        </span>
                        <span className="px-2 py-0.5 text-xs font-semibold rounded bg-zinc-900 text-white border border-zinc-700 flex items-center gap-1">
                          <Users className="w-3 h-3" /> {participantCount} Joined
                        </span>
                      </div>
                      {evt.description && (
                        <p className="text-xs text-zinc-400 line-clamp-1">{evt.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-zinc-500 pt-1">
                        {evt.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-zinc-600" />
                            {evt.location}
                          </span>
                        )}
                        {evt.startDate && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-zinc-600" />
                            {new Date(evt.startDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start md:self-center">
                      <Link
                        href={`/events/${evt.id}/qr`}
                        className="px-3 py-1.5 bg-black hover:bg-zinc-900 text-white border border-zinc-800 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors min-h-[44px]"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        View QR Code
                      </Link>

                      <button
                        onClick={() => handleDeleteEvent(evt.id)}
                        className="p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                        title="Delete Event"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Joined participants list preview */}
                  {participantCount > 0 && (
                    <div className="bg-black/40 p-3 rounded-xl border border-zinc-800 text-xs mt-3">
                      <span className="font-semibold text-zinc-400 block mb-2">
                        Joined Participants ({participantCount}):
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {evt.participants?.map((p, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-900 border border-zinc-800 rounded-lg shadow-sm min-h-[32px]"
                          >
                            {p.user.image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={p.user.image}
                                alt="User"
                                className="w-4 h-4 rounded-full object-cover border border-zinc-700"
                              />
                            ) : (
                              <div className="w-4 h-4 rounded-full bg-zinc-800 text-white text-[9px] font-bold flex items-center justify-center">
                                {(p.user.name || "U").substring(0, 1)}
                              </div>
                            )}
                            <span className="font-medium text-zinc-200">
                              {p.user.name || p.user.email || "User"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Hype Meter Manager */}
                  <HypeMeterManager eventId={evt.id} backendUrl={backendUrl} userId={userId} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
