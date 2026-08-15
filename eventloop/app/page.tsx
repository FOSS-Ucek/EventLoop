import { auth } from "@/auth";
import Link from "next/link";

export default async function Home() {
  const session = await auth();
  let dbUser = null;

  if (session?.user) {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";
      const userQuery = session.user.id
        ? `id=${session.user.id}`
        : `email=${encodeURIComponent(session.user.email || "")}`;

      const res = await fetch(`${backendUrl}/api/user?${userQuery}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data.success) dbUser = data.user;
      }
    } catch (error) {
      console.error("Failed to fetch user profile in Home:", error);
    }
  }

  const userProfile = session?.user
    ? {
        id: dbUser?.id || session.user.id || "",
        name: dbUser?.name ?? session.user.name ?? "User",
        email: dbUser?.email ?? session.user.email ?? "",
        image: dbUser?.image ?? session.user.image ?? "",
        role: dbUser?.role ?? session.user.role ?? "user",
      }
    : null;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">EventLoop App</h1>

      <div className="border p-4 rounded space-y-4">
        <h2 className="text-lg font-semibold">Authentication Status</h2>

        {userProfile ? (
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              {userProfile.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={userProfile.image}
                  alt={userProfile.name}
                  className="w-16 h-16 rounded-full object-cover border"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center font-bold">
                  {(userProfile.name || "U").substring(0, 2)}
                </div>
              )}
              <div>
                <p className="font-bold">{userProfile.name}</p>
                <p className="text-sm text-gray-600">Email: {userProfile.email}</p>
                <p className="text-sm text-gray-600">Role: {userProfile.role}</p>
                <p className="text-xs text-gray-400">ID: {userProfile.id}</p>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Link href="/profile" className="border px-4 py-2 rounded text-sm bg-gray-50 dark:bg-zinc-800">
                Edit Profile
              </Link>
              {userProfile.role === "admin" && (
                <Link href="/admin" className="border px-4 py-2 rounded text-sm bg-gray-50 dark:bg-zinc-800">
                  Admin Dashboard
                </Link>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p>You are currently logged out.</p>
            <Link href="/login" className="inline-block border px-4 py-2 rounded text-sm bg-blue-600 text-white">
              Sign In
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

