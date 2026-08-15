import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import AdminEventsManager from "@/components/AdminEventsManager";

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
      <div className="p-6 max-w-xl mx-auto text-center space-y-4">
        <h1 className="text-xl font-bold text-red-600">Access Denied</h1>
        <p className="text-sm">You need the Admin role to view this page. Your current role is: {session.user.role}</p>
        <Link href="/profile" className="inline-block border px-4 py-2 rounded text-sm bg-gray-50 dark:bg-zinc-800">
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
    <div className="p-6 max-w-5xl mx-auto space-y-10">
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-sm text-gray-500">Manage application events, QR codes, and system users</p>
        </div>
      </div>

      {/* Events Manager Section */}
      <AdminEventsManager
        initialEvents={events}
        backendUrl={backendUrl}
        userId={session.user.id}
      />

      {/* User Registry Section */}
      <div className="space-y-4 pt-4 border-t">
        <h2 className="text-xl font-bold">User Registry ({users.length})</h2>
        <div className="border rounded-2xl p-4 bg-white dark:bg-zinc-900 overflow-x-auto shadow-sm">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b bg-gray-50 dark:bg-zinc-800/50">
                <th className="p-3">User</th>
                <th className="p-3">Email</th>
                <th className="p-3">Role</th>
                <th className="p-3">ID</th>
                <th className="p-3">Joined</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b dark:border-zinc-800 hover:bg-gray-50/50 dark:hover:bg-zinc-800/30">
                  <td className="p-3 flex items-center gap-2">
                    {user.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={user.image} alt="User" className="w-7 h-7 rounded-full object-cover border" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs">
                        {(user.name || "U").substring(0, 2)}
                      </div>
                    )}
                    <span className="font-medium">{user.name || "Unnamed"}</span>
                  </td>
                  <td className="p-3 text-gray-600 dark:text-gray-300">{user.email || "N/A"}</td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        user.role === "admin"
                          ? "bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300"
                          : "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400"
                      }`}
                    >
                      {user.role}
                    </span>
                  </td>
                  <td className="p-3 font-mono text-xs text-gray-400">{user.id}</td>
                  <td className="p-3 text-xs text-gray-500">
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
