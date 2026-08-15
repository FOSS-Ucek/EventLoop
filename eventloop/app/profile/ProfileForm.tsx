"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface UserProfile {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: string;
}

export default function ProfileForm({ user }: { user: UserProfile }) {
  const router = useRouter();
  const [name, setName] = useState(user.name || "");
  const [role, setRole] = useState(user.role);
  const [image, setImage] = useState(user.image || "");
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1.5 * 1024 * 1024) {
      setMessage({
        type: "error",
        text: "Image file is too large (max 1.5MB).",
      });
      return;
    }

    setIsUploading(true);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImage(reader.result as string);
      setIsUploading(false);
      setMessage(null);
    };
    reader.onerror = () => {
      setMessage({ type: "error", text: "Failed to read image file." });
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);

    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";
      const res = await fetch(`${backendUrl}/api/user/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user.id, email: user.email, name, image, role }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to update profile");
      }

      setMessage({ type: "success", text: "Profile updated successfully!" });
      router.refresh();
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Something went wrong";
      setMessage({ type: "error", text: errorMessage });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-4">
      {message && (
        <div
          className={`p-3 text-sm rounded ${
            message.type === "success"
              ? "bg-green-100 text-green-800"
              : "bg-red-100 text-red-800"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Avatar */}
      <div className="space-y-2">
        <label className="block text-sm font-medium">Avatar</label>
        <div className="flex items-center gap-4">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="Avatar" className="w-16 h-16 rounded-full object-cover border" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center font-bold">
              {(name || "U").substring(0, 2)}
            </div>
          )}
          <input type="file" accept="image/*" onChange={handleFileChange} className="text-sm" />
        </div>
        {isUploading && <p className="text-xs text-gray-500">Uploading...</p>}
      </div>

      {/* Email */}
      <div>
        <label className="block text-sm font-medium">Email</label>
        <input
          type="email"
          disabled
          value={user.email || ""}
          className="w-full border p-2 rounded bg-gray-100 text-gray-600 text-sm"
        />
      </div>

      {/* Name */}
      <div>
        <label className="block text-sm font-medium">Display Name</label>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border p-2 rounded text-sm dark:bg-zinc-800"
        />
      </div>

      {/* Role */}
      <div>
        <label className="block text-sm font-medium">Role</label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="w-full border p-2 rounded text-sm dark:bg-zinc-800"
        >
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      <button
        type="submit"
        disabled={isSaving || isUploading}
        className="w-full bg-blue-600 text-white p-2 rounded text-sm font-medium disabled:opacity-50"
      >
        {isSaving ? "Saving..." : "Save Profile"}
      </button>
    </form>
  );
}

