import { auth } from "@/auth";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import QRCodeDisplay from "@/components/QRCodeDisplay";
import { ArrowLeft, Calendar, MapPin, Tag, Shield } from "lucide-react";

export const revalidate = 0;

interface EventData {
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

export default async function EventQRPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  const eventId = resolvedParams.id;
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

  let event: EventData | null = null;

  try {
    const res = await fetch(`${backendUrl}/api/event?id=${eventId}`, {
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.event) {
        event = data.event;
      }
    }
  } catch (error) {
    console.error("Failed to fetch event for QR route:", error);
  }

  if (!event) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center space-y-4 text-white">
        <h1 className="text-2xl font-bold">Event Not Found</h1>
        <p className="text-sm text-zinc-400">
          The requested event could not be found or may have been deleted.
        </p>
        <Link
          href="/admin"
          className="inline-flex items-center justify-center gap-2 border border-zinc-800 px-4 py-2 rounded-lg text-sm bg-zinc-900 hover:bg-zinc-800 min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4" /> Return to Admin
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8 text-white w-full">
      {/* Navigation Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
        <Link
          href="/admin"
          className="inline-flex items-center justify-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors min-h-[44px] pr-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Admin Dashboard
        </Link>
        <span className="text-xs px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-white font-medium">
          Status: {event.status}
        </span>
      </div>

      {/* Main Container */}
      <div className="grid md:grid-cols-2 gap-8 items-start">
        {/* Left Column: Event Metadata */}
        <div className="space-y-6 glass border border-zinc-800 rounded-2xl p-6 shadow-sm">
          <div>
            <span className="text-xs font-semibold text-zinc-500 tracking-wider uppercase">
              Event QR Code
            </span>
            <h1 className="text-2xl font-bold mt-1 text-white">
              {event.title}
            </h1>
          </div>

          {event.description && (
            <p className="text-sm text-zinc-400 leading-relaxed">
              {event.description}
            </p>
          )}

          <div className="space-y-3 pt-2 text-sm border-t border-zinc-800">
            <div className="flex items-center gap-3 text-zinc-400 pt-3">
              <Tag className="w-4 h-4 text-zinc-500 flex-shrink-0" />
              <div>
                <span className="text-xs text-zinc-500 block">Event Access Code</span>
                <span className="font-mono font-semibold text-white">
                  {event.code}
                </span>
              </div>
            </div>

            {event.location && (
              <div className="flex items-center gap-3 text-zinc-400">
                <MapPin className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                <div>
                  <span className="text-xs text-zinc-500 block">Location</span>
                  <span className="text-white">{event.location}</span>
                </div>
              </div>
            )}

            {event.startDate && (
              <div className="flex items-center gap-3 text-zinc-400">
                <Calendar className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                <div>
                  <span className="text-xs text-zinc-500 block">Start Date</span>
                  <span className="text-white">{new Date(event.startDate).toLocaleString("en-US")}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Interactive QR Code Card */}
        <div className="glass border border-zinc-800 rounded-2xl p-6 shadow-sm flex flex-col items-center">
          <h2 className="text-sm font-semibold text-zinc-300 mb-4">
            Scan to Join Event
          </h2>
          <QRCodeDisplay
            eventId={event.id}
            eventCode={event.code}
            eventTitle={event.title}
            eventLocation={event.location}
          />
        </div>
      </div>
    </div>
  );
}
