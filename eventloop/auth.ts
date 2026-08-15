import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  callbacks: {
    async signIn() {
      // Return true to allow sign-in. All database syncing and profile mapping
      // is handled safely in the mutable jwt callback below.
      return true;
    },
    async jwt({ token, user, account }) {
      // The presence of 'account' and 'user' indicates the initial login event
      if (account && user) {
        try {
          // Sync/upsert user record in Express backend MongoDB
          const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";
          const res = await fetch(`${backendUrl}/api/user/upsert`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: user.email,
              name: user.name,
              image: user.image && !user.image.startsWith("data:") ? user.image : null,
            }),
          });

          if (res.ok) {
            const data = await res.json();
            if (data.success && data.user) {
              // Safely set DB details on the mutable token object
              token.id = data.user.id;
              token.role = data.user.role;
              token.name = data.user.name;
              // Never store Base64 images in JWT cookies! Only keep valid short URLs.
              if (data.user.image && !data.user.image.startsWith("data:") && data.user.image.length < 1000) {
                token.picture = data.user.image;
              }
            }
          }
        } catch (error) {
          console.error("❌ Failed to sync user inside JWT callback:", error);
        }
      }

      // Sanitize existing token picture if it contains Base64 or exceeds size limit (prevents HTTP 431)
      if (typeof token.picture === "string" && (token.picture.startsWith("data:") || token.picture.length > 1000)) {
        token.picture = undefined;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string) || (token.sub as string);
        session.user.role = (token.role as string) || "user";
        session.user.name = (token.name as string) || session.user.name || "";
        session.user.image =
          typeof token.picture === "string" && !token.picture.startsWith("data:") && token.picture.length < 1000
            ? token.picture
            : "";
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
});
