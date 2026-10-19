import type { NextAuthConfig } from "next-auth";
import type { AppUserRole } from "@/types/next-auth";

/**
 * The part of the auth setup that needs no database or password hashing — shared by `auth.ts` (which adds the
 * credentials provider) and the proxy. Keeping Prisma and bcrypt out of this file keeps them out of the proxy
 * bundle, which otherwise ships the whole database client (tens of MB) just to read the session cookie.
 */
export const authConfig = {
  providers: [],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.username = user.username;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub as string;
        session.user.role = token.role as AppUserRole;
        session.user.username = token.username as string;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
