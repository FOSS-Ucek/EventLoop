"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, QrCode, Trash2, Calendar, MapPin, Tag, Check, AlertCircle, Sparkles, Users } from "lucide-react";

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
      const res = await fetch(`${backendUrl}/api/events/${id}`, {
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
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h2 className="text-xl font-bold">Event Management</h2>
          <p className="text-sm text-gray-500">Create events, generate QR codes, and track joined participants</p>
        </div>
        <button
          onClick={() => {
            setShowCreateForm(!showCreateForm);
            setError(null);
          }}
          className="py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl shadow-sm flex items-center gap-2 transition-all"
        >
          <Plus className="w-4 h-4" />
          {showCreateForm ? "Cancel" : "Create New Event"}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-xl text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 rounded-xl text-sm flex items-center gap-2">
          <Check className="w-4 h-4 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Create Event Form */}
      {showCreateForm && (
        <form
          onSubmit={handleCreateEvent}
          className="p-6 bg-white dark:bg-zinc-900 border rounded-2xl shadow-sm space-y-4 transition-all"
        >
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-500" />
            Create New Event
          </h3>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="event-title" className="block text-xs font-semibold text-gray-600 dark:text-gray-400">
                Event Title *
              </label>
              <input
                id="event-title"
                type="text"
                required
                placeholder="e.g. Tech Summit 2026"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3.5 py-2 border rounded-xl text-sm bg-gray-50 dark:bg-zinc-800 border-gray-300 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="event-code" className="block text-xs font-semibold text-gray-600 dark:text-gray-400">
                Custom Event Code (Optional)
              </label>
              <input
                id="event-code"
                type="text"
                placeholder="Auto-generated if left blank"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full px-3.5 py-2 border rounded-xl text-sm bg-gray-50 dark:bg-zinc-800 border-gray-300 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="event-location" className="block text-xs font-semibold text-gray-600 dark:text-gray-400">
                Location
              </label>
              <input
                id="event-location"
                type="text"
                placeholder="e.g. Main Auditorium / Online"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-3.5 py-2 border rounded-xl text-sm bg-gray-50 dark:bg-zinc-800 border-gray-300 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="event-start-date" className="block text-xs font-semibold text-gray-600 dark:text-gray-400">
                Start Date & Time
              </label>
              <input
                id="event-start-date"
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3.5 py-2 border rounded-xl text-sm bg-gray-50 dark:bg-zinc-800 border-gray-300 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="event-description" className="block text-xs font-semibold text-gray-600 dark:text-gray-400">
              Description
            </label>
            <textarea
              id="event-description"
              rows={3}
              placeholder="Brief description of the event..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 border rounded-xl text-sm bg-gray-50 dark:bg-zinc-800 border-gray-300 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="px-4 py-2 text-sm border rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-xl shadow-sm disabled:opacity-50 transition-colors"
            >
              {loading ? "Creating..." : "Save Event"}
            </button>
          </div>
        </form>
      )}

      {/* Events List */}
      <div className="bg-white dark:bg-zinc-900 border rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-gray-50 dark:bg-zinc-800/50 flex justify-between items-center">
          <h3 className="font-semibold text-sm">Created Events ({events.length})</h3>
        </div>

        {events.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            No events found. Click &quot;Create New Event&quot; above to create your first event.
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-zinc-800">
            {events.map((evt) => {
              const participantCount = evt.participants?.length || 0;
              return (
                <div
                  key={evt.id}
                  className="p-4 space-y-3 hover:bg-gray-50/50 dark:hover:bg-zinc-800/30 transition-colors"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-base">{evt.title}</h4>
                        <span className="px-2 py-0.5 text-xs font-mono rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                          Code: {evt.code}
                        </span>
                        <span className="px-2 py-0.5 text-xs font-semibold rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                          <Users className="w-3 h-3" /> {participantCount} Joined
                        </span>
                      </div>
                      {evt.description && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-1">{evt.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-gray-500 pt-1">
                        {evt.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-gray-400" />
                            {evt.location}
                          </span>
                        )}
                        {evt.startDate && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-gray-400" />
                            {new Date(evt.startDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start md:self-center">
                      <Link
                        href={`/events/${evt.id}/qr`}
                        className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        View QR Code
                      </Link>

                      <button
                        onClick={() => handleDeleteEvent(evt.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors"
                        title="Delete Event"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Joined participants list preview */}
                  {participantCount > 0 && (
                    <div className="bg-gray-50 dark:bg-zinc-800/40 p-3 rounded-xl border border-gray-100 dark:border-zinc-800/80 text-xs">
                      <span className="font-semibold text-gray-700 dark:text-gray-300 block mb-2">
                        Joined Participants ({participantCount}):
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {evt.participants?.map((p, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-zinc-900 border rounded-lg shadow-2xs"
                          >
                            {p.user.image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={p.user.image}
                                alt="User"
                                className="w-4 h-4 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-4 h-4 rounded-full bg-indigo-200 text-indigo-800 text-[9px] font-bold flex items-center justify-center">
                                {(p.user.name || "U").substring(0, 1)}
                              </div>
                            )}
                            <span className="font-medium text-gray-800 dark:text-gray-200">
                              {p.user.name || p.user.email || "User"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
