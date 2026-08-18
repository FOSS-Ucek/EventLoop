"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEvent } from "@/components/providers/EventProvider";
import { handleSignOut } from "@/app/actions";
import { Home, User, Shield, LogOut, LogIn } from "lucide-react";

interface NavbarProps {
  session: { userId: string; role: string; name: string; image: string } | null;
}

export default function Navbar({ session }: NavbarProps) {
  const { eventConfig } = useEvent();
  const pathname = usePathname();

  // Hide Navbar completely on full-screen hype display route or game display route
  if (pathname?.startsWith("/hype/") || pathname?.startsWith("/game/")) return null;

  return (
    <nav
      className="sticky top-0 z-50 flex items-center justify-between px-4 h-14 border-b bg-black/80 backdrop-blur-xl"
      style={{ minHeight: 'var(--nav-height)' }}
    >
      {/* Left: Brand */}
      <div className="flex items-center gap-3">
        {eventConfig?.brand?.logoUrl && (
          <img
            src={eventConfig.brand.logoUrl}
            alt="Event Logo"
            className="h-7 w-7 rounded object-contain"
          />
        )}
        <Link href="/" className="font-bold text-base tracking-tight text-white">
          EventLoop
        </Link>
      </div>

      {/* Center: Nav Links */}
      <div className="flex items-center gap-1">
        <Link
          href="/"
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-white/5 transition-colors min-h-[44px]"
        >
          <Home className="w-4 h-4" />
          <span className="hidden sm:inline">Home</span>
        </Link>
        {session && (
          <Link
            href="/profile"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-white/5 transition-colors min-h-[44px]"
          >
            <User className="w-4 h-4" />
            <span className="hidden sm:inline">Profile</span>
          </Link>
        )}
        {session?.role === "admin" && (
          <Link
            href="/admin"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-white/5 transition-colors min-h-[44px]"
          >
            <Shield className="w-4 h-4" />
            <span className="hidden sm:inline">Admin</span>
          </Link>
        )}
      </div>

      {/* Right: User */}
      <div className="flex items-center gap-2">
        {session ? (
          <>
            {session.image && (
              <img
                src={session.image}
                alt={session.name}
                className="w-8 h-8 rounded-full object-cover border border-zinc-800"
              />
            )}
            <span className="text-sm text-zinc-400 hidden sm:inline max-w-[120px] truncate">
              {session.name}
            </span>
            <form action={handleSignOut}>
              <button
                type="submit"
                className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm text-zinc-500 hover:text-white hover:bg-white/5 transition-colors min-h-[44px]"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </form>
          </>
        ) : (
          <Link
            href="/login"
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-black bg-white hover:bg-zinc-200 transition-colors min-h-[44px]"
          >
            <LogIn className="w-4 h-4" />
            Sign In
          </Link>
        )}
      </div>
    </nav>
  );
}
