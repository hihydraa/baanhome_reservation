import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "ADMIN" | "STAFF";
      username: string;
    } & DefaultSession["user"];
  }

  interface User {
    role: "ADMIN" | "STAFF";
    username: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: "ADMIN" | "STAFF";
    username: string;
  }
}
