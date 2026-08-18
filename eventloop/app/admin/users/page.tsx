import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Users, Shield } from "lucide-react";
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

export default async function AdminUsersPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  if (session.user.role !== "admin") {
    return (
      <div className="p-6 max-w-xl mx-auto text-center space-y-4 text-white">
        <h1 className="text-xl font-bold">Access Denied</h1>
        <p className="text-sm text-zinc-400">You need the Admin role to view this page.</p>
        <Link href="/profile" className="inline-block border border-zinc-800 px-4 py-2 rounded text-sm bg-zinc-900 hover:bg-zinc-800">
          Go to Profile Settings
        </Link>
      </div>
    );
  }

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";
  let users: DBUser[] = [];
  let fetchError = null;

  try {
    const res = await fetch(`${backendUrl}/api/users`, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        users = data.users || [];
      } else {
        fetchError = data.error || "Failed to load users";
      }
    } else {
      fetchError = `Error fetching users (${res.status})`;
    }
  } catch (error) {
    console.error("Failed to fetch users:", error);
    fetchError = "Network error fetching users";
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8 text-white animate-fade-in w-full">
      {/* Back Button & Header */}
      <div className="space-y-4 border-b border-zinc-800 pb-4">
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-xs font-mono text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Admin Dashboard
        </Link>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center">
              <Users className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">User Registry</h1>
              <p className="text-sm text-zinc-500">Manage registered system accounts and permissions</p>
            </div>
          </div>
          <div className="px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-400">
            Total Users: <span className="font-bold text-white">{users.length}</span>
          </div>
        </div>
      </div>

      {fetchError ? (
        <div className="p-4 rounded-xl border border-red-500/20 bg-red-950/20 text-red-400 text-sm font-medium">
          {fetchError}
        </div>
      ) : (
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
              {users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-zinc-500 text-sm">
                    No registered users found.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
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
                      {user.createdAt ? new Date(user.createdAt).toLocaleDateString("en-US") : "N/A"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
