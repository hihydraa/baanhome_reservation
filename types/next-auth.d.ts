import { DefaultSession } from "next-auth";

export type AppUserRole = "ADMIN" | "STAFF" | "HOUSEKEEPER";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: AppUserRole;
      username: string;
    } & DefaultSession["user"];
  }

  interface User {
    role: AppUserRole;
    username: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: AppUserRole;
    username: string;
  }
}
