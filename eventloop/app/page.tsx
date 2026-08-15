import { auth } from "@/auth";
import HomePageClient from "@/components/HomePageClient";

export const revalidate = 0;

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

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">EventLoop App</h1>

      <HomePageClient userProfile={userProfile} backendUrl={backendUrl} />
    </div>
  );
}
