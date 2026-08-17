import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { EventProvider } from "@/components/providers/EventProvider";
import HypeMeterOverlay from "@/components/HypeMeterOverlay";
import GameOverlay from "@/components/GameOverlay";
import { auth } from "@/auth";


const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "EventLoop — Real-Time Event Companion",
  description:
    "Join live events, build hype, and connect with your crowd in real time.",
  keywords: ["events", "live", "hype meter", "real-time", "companion"],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#000000",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // Build session data for the client-side EventProvider
  let sessionData: { userId: string; role: string; name: string; image: string } | null = null;
  if (session?.user) {
    // Fetch fresh user data from backend to get current role
    let dbUser: any = null;
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
      console.error("Failed to fetch user in layout:", error);
    }

    sessionData = {
      userId: dbUser?.id || session.user.id || "",
      role: dbUser?.role || session.user.role || "user",
      name: dbUser?.name || session.user.name || "User",
      image: dbUser?.image || session.user.image || "",
    };
  }

  return (
    <html lang="en" className={`${inter.variable} antialiased`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (typeof window !== 'undefined' && window.performance && window.performance.measure) {
                const _origMeasure = window.performance.measure.bind(window.performance);
                window.performance.measure = function(name, start, end) {
                  try {
                    return _origMeasure(name, start, end);
                  } catch (e) {
                    if (e && e.message && e.message.includes('negative time stamp')) return;
                    throw e;
                  }
                };
              }
            `,
          }}
        />
      </head>
      <body>
        <EventProvider session={sessionData}>
          <Navbar session={sessionData} />
          <main className="flex-1 flex flex-col">{children}</main>
          <HypeMeterOverlay />
          <GameOverlay />
        </EventProvider>

      </body>
    </html>
  );
}
