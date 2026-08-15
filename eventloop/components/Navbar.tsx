import Link from "next/link";
import { auth, signOut } from "@/auth";

export default async function Navbar() {
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
      console.error("Failed to fetch user profile in Navbar:", error);
    }
  }

  const userProfile = session?.user
    ? {
        name: dbUser?.name ?? session.user.name ?? "User",
        role: dbUser?.role ?? session.user.role ?? "user",
        image: dbUser?.image ?? session.user.image ?? "",
      }
    : null;

  return (
    <nav className="border-b p-4 flex items-center justify-between bg-white dark:bg-zinc-900">
      <div className="flex items-center gap-4">
        <Link href="/" className="font-bold text-lg">
          EventLoop
        </Link>
        <Link href="/" className="text-sm underline">
          Home
        </Link>
        {session && (
          <Link href="/profile" className="text-sm underline">
            Profile
          </Link>
        )}
        {userProfile?.role === "admin" && (
          <Link href="/admin" className="text-sm underline font-semibold">
            Admin
          </Link>
        )}
      </div>

      <div className="flex items-center gap-3 text-sm">
        {userProfile ? (
          <>
            {userProfile.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={userProfile.image}
                alt="Avatar"
                className="w-8 h-8 rounded-full object-cover border"
              />
            )}
            <span>
              {userProfile.name} ({userProfile.role})
            </span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <button type="submit" className="border px-3 py-1 rounded text-xs">
                Sign Out
              </button>
            </form>
          </>
        ) : (
          <Link href="/login" className="border px-3 py-1 rounded text-xs">
            Sign In
          </Link>
        )}
      </div>
    </nav>
  );
}

