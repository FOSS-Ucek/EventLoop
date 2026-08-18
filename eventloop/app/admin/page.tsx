import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Users, ArrowRight } from "lucide-react";
import AdminEventsManager from "@/components/AdminEventsManager";

export const revalidate = 0;

export default async function AdminPage() {
  const session = await auth();

  // Redirect unauthenticated users directly to login without showing scan event
  if (!session?.user?.id) {
    redirect("/login");
  }

  if (session.user.role !== "admin") {
    return (
      <div className="p-6 max-w-xl mx-auto text-center space-y-4 text-white">
        <h1 className="text-xl font-bold">Access Denied</h1>
        <p className="text-sm text-zinc-400">You need the Admin role to view this page. Your current role is: {session.user.role}</p>
        <Link href="/profile" className="inline-block border border-zinc-800 px-4 py-2 rounded text-sm bg-zinc-900 hover:bg-zinc-800 min-h-[44px] flex items-center justify-center mx-auto max-w-fit">
          Go to Profile Settings
        </Link>
      </div>
    );
  }

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";
  let events = [];

  try {
    const eventsRes = await fetch(`${backendUrl}/api/events`, { cache: "no-store" });
    if (eventsRes.ok) {
      const data = await eventsRes.json();
      if (data.success) events = data.events;
    }
  } catch (error) {
    console.error("Failed to fetch events from backend:", error);
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-10 text-white animate-fade-in w-full">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-sm text-zinc-500">Manage application events, QR codes, and system users</p>
        </div>
      </div>

      {/* Events Manager Section */}
      <AdminEventsManager
        initialEvents={events}
        backendUrl={backendUrl}
        userId={session.user.id}
      />

      {/* User Registry Card Link Section */}
      <div className="space-y-4 pt-4 border-t border-zinc-800">
        <h2 className="text-xl font-bold">User Management</h2>
        <div className="border border-zinc-800 rounded-2xl p-6 glass-strong shadow-sm hover:border-zinc-700 transition-all">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
                <Users className="w-6 h-6 text-indigo-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">User Registry & Roles</h3>
                <p className="text-sm text-zinc-400 mt-0.5">
                  View registered system accounts, search user details, and assign admin permissions on a dedicated management page.
                </p>
              </div>
            </div>
            <Link
              href="/admin/users"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all active:scale-95 flex-shrink-0 shadow-lg"
            >
              Manage Users <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
