"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import QRScanner from "@/components/QRScanner";
import { Calendar, LogOut, AlertCircle, LogIn, Pencil, QrCode, Loader2 } from "lucide-react";
import { useEvent } from "@/components/providers/EventProvider";

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
  logoUrl?: string | null;
  createdAt: string;
}

interface HomePageClientProps {
  userProfile: UserProfile | null;
  backendUrl: string;
}

export default function HomePageClient({ userProfile, backendUrl }: HomePageClientProps) {
  const { setEventId, eventConfig } = useEvent();

  const [activeEvent, setActiveEvent] = useState<EventItem | null>(null);

  const [showScanner, setShowScanner] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingEventCode, setPendingEventCode] = useState<string | null>(null);

  const hideLeaveButton =
    process.env.NEXT_PUBLIC_DISABLE_LEAVE_BUTTON === "true" ||
    process.env.NEXT_PUBLIC_HIDE_LEAVE_BUTTON === "true";

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
        setEventId(data.event.id); // Integrate with EventProvider
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
      let isSubscribed = true;
      const envEventId = process.env.NEXT_PUBLIC_EVENT_ID;

      // Restore cached event from localStorage after mount to avoid a hydration mismatch
      try {
        const stored = localStorage.getItem("activeEvent");
        if (stored) setActiveEvent(JSON.parse(stored));
      } catch {}

      const loadEventData = async () => {
        setIsInitialLoading(true);

        if (envEventId) {
          if (userProfile?.id) {
            await joinEventOnBackend(envEventId);
          } else {
            try {
              const res = await fetch(`${backendUrl}/api/event/state?eventId=${envEventId}`);
              const data = await res.json();
              if (res.ok && data.success && data.config) {
                const eventObj: EventItem = {
                  id: data.config.eventId,
                  title: data.config.eventName,
                  code: data.config.eventId,
                  status: "active",
                  logoUrl: data.config.brand?.logoUrl,
                  createdAt: new Date().toISOString(),
                };
                if (isSubscribed) {
                  setActiveEvent(eventObj);
                  setEventId(envEventId);
                }
              }
            } catch (err) {
              console.error("Failed to resolve env event ID:", err);
            }
          }
        } else if (!userProfile?.id) {
          if (isSubscribed) {
            setActiveEvent(null);
            localStorage.removeItem("activeEvent");
            setEventId(null);
          }
        } else {
          // User is logged in: fetch joined events from database
          try {
            const res = await fetch(`${backendUrl}/api/user/joined-events?userId=${userProfile.id}`);
            const data = await res.json();
            if (res.ok && data.success && Array.isArray(data.events) && data.events.length > 0) {
              const latestEvent = data.events[0];
              if (isSubscribed) {
                setActiveEvent(latestEvent);
                localStorage.setItem("activeEvent", JSON.stringify(latestEvent));
                setEventId(latestEvent.id);
              }
            }
          } catch (err) {
            console.error("Failed to load joined events from backend:", err);
          }
        }

        // Check URL parameters for scanned event code
        const urlParams = new URLSearchParams(window.location.search);
        const codeFromUrl = urlParams.get("eventCode") || urlParams.get("code") || urlParams.get("eventId");

        if (codeFromUrl) {
          if (userProfile?.id) {
            await joinEventOnBackend(codeFromUrl);
          } else {
            if (isSubscribed) {
              setPendingEventCode(codeFromUrl);
              setError("You scanned an event QR code, but you must be signed in to join.");
            }
          }
          const newUrl = window.location.pathname;
          window.history.replaceState({}, "", newUrl);
        }

        if (isSubscribed) {
          setIsInitialLoading(false);
        }
      };

      loadEventData();

      return () => {
        isSubscribed = false;
      };
    }
  }, [userProfile?.id, backendUrl, setEventId]);

  const handleScanSuccess = (scannedCode: string) => {
    joinEventOnBackend(scannedCode);
  };

  const handleLeaveEvent = () => {
    setActiveEvent(null);
    localStorage.removeItem("activeEvent");
    setEventId(null);
    setError(null);
  };

  const eventImageUrl = activeEvent?.logoUrl || eventConfig?.brand?.logoUrl;

  return (
    <div className="space-y-8 animate-fade-in w-full text-white flex flex-col items-center justify-center">
      {/* Error Notification */}
      {error && (
        <div className="p-4 bg-zinc-900 border border-zinc-700/50 text-white rounded-2xl text-sm flex items-center justify-between shadow-sm animate-slide-up min-h-[44px] w-full max-w-md">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-white flex-shrink-0" />
            <span>{error}</span>
          </div>
          {!userProfile && (
            <Link
              href="/login"
              className="px-3 py-1.5 bg-white text-black rounded-xl text-xs font-semibold hover:bg-zinc-200 flex items-center gap-1 min-h-[44px]"
            >
              <LogIn className="w-3.5 h-3.5" /> Sign In Now
            </Link>
          )}
        </div>
      )}

      {/* INITIAL LOADING STATE */}
      {isInitialLoading && !activeEvent ? (
        <div className="glass-strong border border-zinc-800 rounded-3xl p-10 text-center space-y-4 animate-slide-up w-full max-w-md flex flex-col items-center justify-center min-h-[250px]">
          <Loader2 className="w-9 h-9 text-white animate-spin" />
          <p className="text-sm font-medium text-zinc-400 animate-pulse">Loading Event...</p>
        </div>
      ) : userProfile && activeEvent ? (
        /* ACTIVE EVENT CONTAINER */
        <div className="glass-strong border border-zinc-800 text-white rounded-3xl p-8 shadow-2xl space-y-6 relative overflow-hidden animate-slide-up flex flex-col items-center text-center w-full max-w-md">
          {/* Action button (Leave) if enabled by env */}
          {!hideLeaveButton && (
            <div className="absolute top-4 right-4 flex items-center gap-2">
              <button
                onClick={handleLeaveEvent}
                title="Leave Event"
                className="p-2 bg-zinc-800/60 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-xl text-xs transition-colors border border-zinc-700/50"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Event Image in Center */}
          <div className="flex flex-col items-center justify-center pt-2">
            {eventImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={eventImageUrl}
                alt={activeEvent.title}
                className="w-44 h-44 sm:w-56 sm:h-56 object-cover rounded-2xl border-2 border-zinc-700/80 shadow-2xl mx-auto"
              />
            ) : (
              <div className="w-44 h-44 sm:w-56 sm:h-56 rounded-2xl bg-gradient-to-br from-zinc-800 to-zinc-900 border-2 border-zinc-700/80 flex flex-col items-center justify-center p-4 shadow-2xl mx-auto">
                <Calendar className="w-16 h-16 text-zinc-400 mb-2" />
                <span className="font-bold text-base text-zinc-200 line-clamp-2 px-2">
                  {activeEvent.title}
                </span>
              </div>
            )}
          </div>

          {/* Logged in User Image and Name below */}
          <div className="pt-6 border-t border-zinc-800/80 w-full max-w-sm flex flex-col items-center space-y-4">
            <div className="flex items-center gap-3">
              <Link href="/profile" className="relative group cursor-pointer" title="Edit Profile">
                {userProfile.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={userProfile.image}
                    alt={userProfile.name}
                    className="w-14 h-14 rounded-full object-cover border-2 border-white/20 shadow-md group-hover:border-white/50 transition-all"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-zinc-800 border-2 border-white/20 text-white font-bold flex items-center justify-center text-lg shadow-md group-hover:border-white/50 transition-all">
                    {(userProfile.name || "U").substring(0, 2).toUpperCase()}
                  </div>
                )}
                {/* Edit icon overlay badge */}
                <div className="absolute bottom-0 right-0 bg-white text-black p-0.5 rounded-full shadow border border-zinc-800 group-hover:scale-110 transition-transform">
                  <Pencil className="w-2.5 h-2.5" />
                </div>
              </Link>

              <div className="text-left">
                <p className="font-bold text-base text-white">{userProfile.name}</p>
                <p className="text-xs text-zinc-400">{userProfile.email}</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* HERO & QR SCANNER CONTAINER */
        <div className="glass-strong border border-zinc-800 rounded-3xl p-6 md:p-10 text-center space-y-6 animate-slide-up w-full max-w-md">
          <div className="max-w-xl mx-auto space-y-3">
            <div className="w-14 h-14 bg-zinc-900 text-white border border-zinc-800 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
              <QrCode className="w-7 h-7" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-white">Enter an Event</h2>
            <p className="text-sm text-zinc-400 leading-relaxed">
              {userProfile
                ? "Scan an event QR code or enter an event access code to join and register on the backend."
                : "Only logged-in users can join an event. Please sign in to scan and join."}
            </p>
          </div>

          {!userProfile ? (
            <div className="pt-2">
              <Link
                href="/login"
                className="py-3 px-8 bg-white hover:bg-zinc-200 text-black font-medium rounded-2xl shadow-lg inline-flex items-center gap-2 transition-all hover:scale-105 min-h-[44px]"
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
                    className="py-3 px-8 bg-white hover:bg-zinc-200 text-black font-medium rounded-2xl shadow-lg inline-flex items-center gap-2 transition-all hover:scale-105 min-h-[44px]"
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
    </div>
  );
}
