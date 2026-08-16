"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface AdminUserRoleSelectProps {
  userId: string;
  currentRole: string;
  targetUserId: string;
  backendUrl: string;
}

export default function AdminUserRoleSelect({
  userId,
  currentRole,
  targetUserId,
  backendUrl,
}: AdminUserRoleSelectProps) {
  const router = useRouter();
  const [role, setRole] = useState(currentRole);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleRoleChange = async (newRole: string) => {
    if (newRole === role) return;
    setIsUpdating(true);

    try {
      const res = await fetch(`${backendUrl}/api/user/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: targetUserId,
          role: newRole,
          userId: userId,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setRole(newRole);
        router.refresh();
      } else {
        alert(data.error || "Failed to update user role");
      }
    } catch (err) {
      console.error("Failed to update role:", err);
      alert("An error occurred while updating the role");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <select
      value={role}
      disabled={isUpdating}
      onChange={(e) => handleRoleChange(e.target.value)}
      className="bg-black text-xs font-semibold px-2 py-1 rounded border border-zinc-700 text-white focus:outline-none focus:border-zinc-500 cursor-pointer disabled:opacity-50 min-h-[36px]"
    >
      <option value="user">user</option>
      <option value="admin">admin</option>
    </select>
  );
}
