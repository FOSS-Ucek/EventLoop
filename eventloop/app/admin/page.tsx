import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

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

  try {
    const res = await fetch(`${backendUrl}/api/users`, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (data.success) users = data.users;
    }
  } catch (error) {
    console.error("Failed to fetch user registry from backend:", error);
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Admin Panel</h1>

      <div className="border rounded p-4 bg-white dark:bg-zinc-900 overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="border-b bg-gray-50 dark:bg-zinc-800">
              <th className="p-2">User</th>
              <th className="p-2">Email</th>
              <th className="p-2">Role</th>
              <th className="p-2">ID</th>
              <th className="p-2">Joined</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b">
                <td className="p-2 flex items-center gap-2">
                  {user.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.image} alt="User" className="w-6 h-6 rounded-full object-cover border" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold">
                      {(user.name || "U").substring(0, 2)}
                    </div>
                  )}
                  <span>{user.name || "Unnamed"}</span>
                </td>
                <td className="p-2">{user.email || "N/A"}</td>
                <td className="p-2">{user.role}</td>
                <td className="p-2 font-mono text-xs">{user.id}</td>
                <td className="p-2 text-xs">
                  {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "N/A"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

