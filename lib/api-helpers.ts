import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { auth } from "@/auth";

export async function requireSession() {
  const session = await auth();
  if (!session?.user) {
    return { session: null, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { session, response: null };
}

export async function requireAdmin() {
  const session = await auth();
  if (!session?.user) {
    return { session: null, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (session.user.role !== "ADMIN") {
    return { session: null, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session, response: null };
}

export function zodErrorResponse(error: ZodError) {
  const issues = error.issues.map((i) => ({ path: i.path, message: i.message }));
  const message = issues.map((i) => i.message).join(" / ") || "ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง";
  return NextResponse.json({ error: message, issues }, { status: 400 });
}

export function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
