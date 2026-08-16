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
        body: JSON.stringify({ id: user.id, email: user.email, name, image }),
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
    <form onSubmit={handleSave} className="space-y-6">
      {message && (
        <div
          className={`p-3 text-sm rounded-lg border min-h-[44px] flex items-center ${
            message.type === "success"
              ? "bg-zinc-900 border-zinc-700 text-white"
              : "bg-black border-zinc-700 text-zinc-300"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Avatar */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-zinc-300">Avatar</label>
        <div className="flex items-center gap-4">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="Avatar" className="w-16 h-16 rounded-full object-cover border border-zinc-700" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center font-bold text-white">
              {(name || "U").substring(0, 2)}
            </div>
          )}
          <input type="file" accept="image/*" onChange={handleFileChange} className="text-sm text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-zinc-800 file:text-white hover:file:bg-zinc-700 min-h-[44px]" />
        </div>
        {isUploading && <p className="text-xs text-zinc-500">Uploading...</p>}
      </div>

      {/* Email */}
      <div className="space-y-1">
        <label className="block text-sm font-medium text-zinc-300">Email</label>
        <input
          type="email"
          disabled
          value={user.email || ""}
          className="w-full border border-zinc-800 p-3 rounded-xl bg-black text-zinc-500 text-sm min-h-[44px] cursor-not-allowed"
        />
      </div>

      {/* Name */}
      <div className="space-y-1">
        <label className="block text-sm font-medium text-zinc-300">Display Name</label>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border border-zinc-800 p-3 rounded-xl text-sm bg-black text-white focus:outline-none focus:border-zinc-500 min-h-[44px]"
        />
      </div>

      <div className="pt-4">
        <button
          type="submit"
          disabled={isSaving || isUploading}
          className="w-full bg-white text-black p-3 rounded-xl text-sm font-medium disabled:opacity-50 hover:bg-zinc-200 transition-colors min-h-[44px]"
        >
          {isSaving ? "Saving..." : "Save Profile"}
        </button>
      </div>
    </form>
  );
}
