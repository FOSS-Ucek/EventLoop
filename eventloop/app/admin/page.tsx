import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import AdminEventsManager from "@/components/AdminEventsManager";
import AdminUserRoleSelect from "@/components/AdminUserRoleSelect";

export const revalidate = 0;

interface DBUser {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: string;
  createdAt: string;
}

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
  let users: DBUser[] = [];
  let events = [];

  try {
    const [usersRes, eventsRes] = await Promise.all([
      fetch(`${backendUrl}/api/users`, { cache: "no-store" }),
      fetch(`${backendUrl}/api/events`, { cache: "no-store" }),
    ]);

    if (usersRes.ok) {
      const data = await usersRes.json();
      if (data.success) users = data.users;
    }

    if (eventsRes.ok) {
      const data = await eventsRes.json();
      if (data.success) events = data.events;
    }
  } catch (error) {
    console.error("Failed to fetch data from backend:", error);
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

      {/* User Registry Section */}
      <div className="space-y-4 pt-4 border-t border-zinc-800">
        <h2 className="text-xl font-bold">User Registry ({users.length})</h2>
        <div className="border border-zinc-800 rounded-2xl p-4 glass-strong overflow-x-auto shadow-sm">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 bg-black/40">
                <th className="p-3 text-zinc-400 font-semibold">User</th>
                <th className="p-3 text-zinc-400 font-semibold">Email</th>
                <th className="p-3 text-zinc-400 font-semibold">Role</th>
                <th className="p-3 text-zinc-400 font-semibold">ID</th>
                <th className="p-3 text-zinc-400 font-semibold">Joined</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                  <td className="p-3 flex items-center gap-2">
                    {user.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={user.image} alt="User" className="w-7 h-7 rounded-full object-cover border border-zinc-700" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700 text-white font-bold flex items-center justify-center text-xs">
                        {(user.name || "U").substring(0, 2)}
                      </div>
                    )}
                    <span className="font-medium">{user.name || "Unnamed"}</span>
                  </td>
                  <td className="p-3 text-zinc-400">{user.email || "N/A"}</td>
                  <td className="p-3">
                    <AdminUserRoleSelect
                      userId={session.user.id}
                      currentRole={user.role}
                      targetUserId={user.id}
                      backendUrl={backendUrl}
                    />
                  </td>
                  <td className="p-3 font-mono text-xs text-zinc-600">{user.id}</td>
                  <td className="p-3 text-xs text-zinc-500">
                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "N/A"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
