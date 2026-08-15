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
      <div className="p-8 max-w-lg mx-auto text-center space-y-4">
        <h1 className="text-2xl font-bold text-red-600">Event Not Found</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          The requested event could not be found or may have been deleted.
        </p>
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 border px-4 py-2 rounded-lg text-sm bg-gray-50 dark:bg-zinc-800 hover:bg-gray-100"
        >
          <ArrowLeft className="w-4 h-4" /> Return to Admin
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8">
      {/* Navigation Header */}
      <div className="flex items-center justify-between border-b pb-4">
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-indigo-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Admin Dashboard
        </Link>
        <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-medium">
          Status: {event.status}
        </span>
      </div>

      {/* Main Container */}
      <div className="grid md:grid-cols-2 gap-8 items-start">
        {/* Left Column: Event Metadata */}
        <div className="space-y-6 bg-white dark:bg-zinc-900 border rounded-2xl p-6 shadow-sm">
          <div>
            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 tracking-wider uppercase">
              Event QR Code
            </span>
            <h1 className="text-2xl font-bold mt-1 text-gray-900 dark:text-white">
              {event.title}
            </h1>
          </div>

          {event.description && (
            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
              {event.description}
            </p>
          )}

          <div className="space-y-3 pt-2 text-sm border-t border-gray-100 dark:border-zinc-800">
            <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
              <Tag className="w-4 h-4 text-indigo-500 flex-shrink-0" />
              <div>
                <span className="text-xs text-gray-400 block">Event Access Code</span>
                <span className="font-mono font-semibold text-gray-900 dark:text-gray-100">
                  {event.code}
                </span>
              </div>
            </div>

            {event.location && (
              <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
                <MapPin className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                <div>
                  <span className="text-xs text-gray-400 block">Location</span>
                  <span>{event.location}</span>
                </div>
              </div>
            )}

            {event.startDate && (
              <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
                <Calendar className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                <div>
                  <span className="text-xs text-gray-400 block">Start Date</span>
                  <span>{new Date(event.startDate).toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Interactive QR Code Card */}
        <div className="bg-white dark:bg-zinc-900 border rounded-2xl p-6 shadow-sm flex flex-col items-center">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
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
