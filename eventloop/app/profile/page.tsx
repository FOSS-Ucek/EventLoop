import { auth } from "@/auth";
import { redirect } from "next/navigation";
import ProfileForm from "./ProfileForm";

export const revalidate = 0;

export default async function ProfilePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";
  let dbUser = null;

  try {
    const userQuery = session.user.id
      ? `id=${session.user.id}`
      : `email=${encodeURIComponent(session.user.email || "")}`;

    const res = await fetch(`${backendUrl}/api/user?${userQuery}`, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (data.success) dbUser = data.user;
    }
  } catch (error) {
    console.error("Failed to fetch user from backend:", error);
  }

  const userProfile = {
    id: dbUser?.id || session.user.id || "",
    name: dbUser?.name ?? session.user.name ?? "",
    email: dbUser?.email ?? session.user.email ?? "",
    image: dbUser?.image ?? session.user.image ?? "",
    role: dbUser?.role ?? session.user.role ?? "user",
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Profile Settings</h1>
      <div className="border p-6 rounded bg-white dark:bg-zinc-900">
        <ProfileForm user={userProfile} />
      </div>
    </div>
  );
}

