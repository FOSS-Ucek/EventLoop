"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import QRScanner from "@/components/QRScanner";
import { QrCode, Calendar, MapPin, Tag, LogOut, CheckCircle2, AlertCircle, Sparkles, ExternalLink, LogIn } from "lucide-react";
import HypeMeterParticipant from "@/components/HypeMeterParticipant";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  image: string;
  role: string;
}

interface EventItem {
  id: string;
  title: string;
  description?: string | null;
  location?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  code: string;
  status: string;
  createdAt: string;
}

interface HomePageClientProps {
  userProfile: UserProfile | null;
  backendUrl: string;
}

export default function HomePageClient({ userProfile, backendUrl }: HomePageClientProps) {
  const [activeEvent, setActiveEvent] = useState<EventItem | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [pendingEventCode, setPendingEventCode] = useState<string | null>(null);

  // Helper to join event on backend (Requires authenticated user)
  const joinEventOnBackend = async (codeOrId: string) => {
    if (!userProfile?.id) {
      setPendingEventCode(codeOrId);
      setError("Only logged-in users can join an event. Please sign in to continue.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const isObjectId = /^[0-9a-fA-F]{24}$/.test(codeOrId);
      const payload = isObjectId
        ? { userId: userProfile.id, eventId: codeOrId }
        : { userId: userProfile.id, code: codeOrId };

      const res = await fetch(`${backendUrl}/api/event/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok && data.success && data.event) {
        setActiveEvent(data.event);
        localStorage.setItem("activeEvent", JSON.stringify(data.event));
        setSuccessMsg(`Successfully joined event "${data.event.title}"!`);
        setShowScanner(false);
        setPendingEventCode(null);
      } else {
        setError(data.error || `Failed to join event "${codeOrId}"`);
      }
    } catch (err) {
      console.error("Failed to join event on backend:", err);
      setError("Network error connecting to backend server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      // 1. If user is logged out, clear active event state and localStorage
      if (!userProfile?.id) {
        setActiveEvent(null);
        localStorage.removeItem("activeEvent");
      } else {
        // 2. User is logged in: fetch joined events from database
        const fetchJoinedEvents = async () => {
          try {
            const res = await fetch(`${backendUrl}/api/user/joined-events?userId=${userProfile.id}`);
            const data = await res.json();
            if (res.ok && data.success && Array.isArray(data.events) && data.events.length > 0) {
              const latestEvent = data.events[0];
              setActiveEvent(latestEvent);
              localStorage.setItem("activeEvent", JSON.stringify(latestEvent));
            }
          } catch (err) {
            console.error("Failed to load joined events from backend:", err);
          }
        };

        fetchJoinedEvents();
      }

      // 3. Check URL parameters for scanned event code
      const urlParams = new URLSearchParams(window.location.search);
      const codeFromUrl = urlParams.get("eventCode") || urlParams.get("code") || urlParams.get("eventId");

      if (codeFromUrl) {
        if (userProfile?.id) {
          joinEventOnBackend(codeFromUrl);
        } else {
          setPendingEventCode(codeFromUrl);
          setError("You scanned an event QR code, but you must be signed in to join.");
        }
        // Clean URL query
        const newUrl = window.location.pathname;
        window.history.replaceState({}, "", newUrl);
      }
    }
  }, [userProfile?.id, backendUrl]);

  const handleScanSuccess = (scannedCode: string) => {
    joinEventOnBackend(scannedCode);
  };

  const handleLeaveEvent = () => {
    setActiveEvent(null);
    localStorage.removeItem("activeEvent");
    setSuccessMsg(null);
    setError(null);
  };

  return (
    <div className="space-y-8">
      {/* Notifications */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 rounded-2xl text-sm flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <span className="font-medium">{successMsg}</span>
          </div>
          <button
            onClick={() => setSuccessMsg(null)}
            className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 rounded-2xl text-sm flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
          {!userProfile && (
            <Link
              href="/login"
              className="px-3 py-1.5 bg-amber-600 text-white rounded-xl text-xs font-semibold hover:bg-amber-700 flex items-center gap-1"
            >
              <LogIn className="w-3.5 h-3.5" /> Sign In Now
            </Link>
          )}
        </div>
      )}

      {/* ACTIVE EVENT CONTAINER */}
      {userProfile && activeEvent ? (
        <div className="bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 text-white rounded-3xl p-6 md:p-8 shadow-2xl space-y-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-8 -mr-8 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>

          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-indigo-700/50 pb-4">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-semibold rounded-full uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                Active Event (Synced with DB)
              </span>
              <span className="text-xs font-mono text-indigo-200 bg-indigo-950/60 px-2.5 py-1 rounded-md border border-indigo-700/60">
                Code: {activeEvent.code}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  if (!userProfile) {
                    setError("Please sign in to scan and join an event.");
                    return;
                  }
                  setShowScanner(true);
                }}
                className="px-3.5 py-1.5 bg-white/10 hover:bg-white/20 text-xs font-medium rounded-xl backdrop-blur-md transition-colors flex items-center gap-1.5"
              >
                <QrCode className="w-3.5 h-3.5" /> Switch / Scan QR
              </button>
              <button
                onClick={handleLeaveEvent}
                className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-200 border border-red-400/30 text-xs font-medium rounded-xl transition-colors flex items-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" /> Leave Event
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">{activeEvent.title}</h2>
            {activeEvent.description && (
              <p className="text-indigo-100 text-sm max-w-2xl leading-relaxed">
                {activeEvent.description}
              </p>
            )}
          </div>

          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 pt-2 text-xs text-indigo-200">
            {activeEvent.location && (
              <div className="flex items-center gap-2 bg-indigo-950/40 p-3 rounded-xl border border-indigo-700/40">
                <MapPin className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                <div>
                  <span className="text-indigo-400 block text-[10px] uppercase font-bold">Location</span>
                  <span className="font-medium text-white">{activeEvent.location}</span>
                </div>
              </div>
            )}

            {activeEvent.startDate && (
              <div className="flex items-center gap-2 bg-indigo-950/40 p-3 rounded-xl border border-indigo-700/40">
                <Calendar className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                <div>
                  <span className="text-indigo-400 block text-[10px] uppercase font-bold">Date</span>
                  <span className="font-medium text-white">
                    {new Date(activeEvent.startDate).toLocaleString()}
                  </span>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 bg-indigo-950/40 p-3 rounded-xl border border-indigo-700/40">
              <Tag className="w-4 h-4 text-indigo-400 flex-shrink-0" />
              <div>
                <span className="text-indigo-400 block text-[10px] uppercase font-bold">QR View</span>
                <Link
                  href={`/events/${activeEvent.id}/qr`}
                  className="font-medium text-indigo-300 hover:text-white underline flex items-center gap-1"
                >
                  View QR Badge <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            </div>
          </div>
          
          {/* Hype Meter */}
          <HypeMeterParticipant eventId={activeEvent.id} backendUrl={backendUrl} userProfile={userProfile} />
        </div>
      ) : (
        /* HERO & QR SCANNER CONTAINER */
        <div className="bg-white dark:bg-zinc-900 border rounded-3xl p-6 md:p-10 shadow-xl text-center space-y-6">
          <div className="max-w-xl mx-auto space-y-3">
            <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
              <QrCode className="w-7 h-7" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight">Enter an Event</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              {userProfile
                ? "Scan an event QR code or enter an event access code to join and register on the backend."
                : "Only logged-in users can join an event. Please sign in to scan and join."}
            </p>
          </div>

          {!userProfile ? (
            <div className="pt-2">
              <Link
                href="/login"
                className="py-3 px-8 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-2xl shadow-lg shadow-indigo-500/25 inline-flex items-center gap-2 transition-all hover:scale-105"
              >
                <LogIn className="w-5 h-5" />
                Sign In to Scan QR &amp; Join Event
              </Link>
            </div>
          ) : (
            <>
              {!showScanner && (
                <div className="pt-2">
                  <button
                    onClick={() => setShowScanner(true)}
                    className="py-3 px-8 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-2xl shadow-lg shadow-indigo-500/25 inline-flex items-center gap-2 transition-all hover:scale-105"
                  >
                    <QrCode className="w-5 h-5" />
                    Scan QR to Enter Event
                  </button>
                </div>
              )}

              {showScanner && (
                <div className="pt-4 max-w-md mx-auto">
                  <QRScanner
                    onScanSuccess={handleScanSuccess}
                    onCancel={() => setShowScanner(false)}
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* USER AUTH STATUS CARD */}
      <div className="border p-6 rounded-2xl bg-white dark:bg-zinc-900 shadow-sm space-y-4">
        <h3 className="text-base font-semibold border-b pb-3">User Profile Status</h3>

        {userProfile ? (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {userProfile.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={userProfile.image}
                  alt={userProfile.name}
                  className="w-12 h-12 rounded-full object-cover border"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold flex items-center justify-center text-sm">
                  {(userProfile.name || "U").substring(0, 2)}
                </div>
              )}
              <div>
                <p className="font-bold text-sm">{userProfile.name}</p>
                <p className="text-xs text-gray-500">{userProfile.email}</p>
                <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                  Signed In ({userProfile.role})
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <Link href="/profile" className="border px-3.5 py-1.5 rounded-xl text-xs bg-gray-50 dark:bg-zinc-800 hover:bg-gray-100">
                Edit Profile
              </Link>
              {userProfile.role === "admin" && (
                <Link href="/admin" className="border px-3.5 py-1.5 rounded-xl text-xs bg-indigo-600 text-white font-medium hover:bg-indigo-700">
                  Admin Dashboard
                </Link>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">You are currently logged out.</p>
              <p className="text-xs text-gray-400">Sign in is required to join events and scan QR codes.</p>
            </div>
            <Link href="/login" className="border px-4 py-2 rounded-xl text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700">
              Sign In
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
