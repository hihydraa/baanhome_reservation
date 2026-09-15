import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAdmin, zodErrorResponse, errorResponse } from "@/lib/api-helpers";
import { userInputSchema } from "@/lib/validators";

export async function GET() {
  const { response } = await requireAdmin();
  if (response) return response;

  const users = await prisma.user.findMany({
    select: { id: true, name: true, username: true, role: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const { response } = await requireAdmin();
  if (response) return response;

  const body = await req.json();
  const parsed = userInputSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const data = parsed.data;

  const existing = await prisma.user.findUnique({ where: { username: data.username } });
  if (existing) return errorResponse("มีชื่อผู้ใช้นี้อยู่แล้ว", 409);

  const passwordHash = await bcrypt.hash(data.password, 10);
  const user = await prisma.user.create({
    data: { name: data.name, username: data.username, passwordHash, role: data.role },
    select: { id: true, name: true, username: true, role: true, createdAt: true },
  });

  return NextResponse.json(user, { status: 201 });
}
