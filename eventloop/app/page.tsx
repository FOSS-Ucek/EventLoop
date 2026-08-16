import { auth } from "@/auth";
import { redirect } from "next/navigation";
import HomePageClient from "@/components/HomePageClient";

export const revalidate = 0;

export default async function Home() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  let dbUser = null;

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

  const userProfile = {
    id: dbUser?.id || session.user.id || "",
    name: dbUser?.name ?? session.user.name ?? "User",
    email: dbUser?.email ?? session.user.email ?? "",
    image: dbUser?.image ?? session.user.image ?? "",
    role: dbUser?.role ?? session.user.role ?? "user",
  };

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

  return (
    <div className="flex-1 flex flex-col p-6 max-w-4xl mx-auto space-y-6 w-full items-center justify-center min-h-[calc(100vh-2rem)]">
      <HomePageClient userProfile={userProfile} backendUrl={backendUrl} />
    </div>
  );
}
