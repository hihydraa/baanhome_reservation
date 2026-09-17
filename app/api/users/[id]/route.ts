import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAdmin, zodErrorResponse, errorResponse } from "@/lib/api-helpers";
import { userUpdateInputSchema } from "@/lib/validators";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { response } = await requireAdmin();
  if (response) return response;

  const { id } = await params;
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return errorResponse("ไม่พบผู้ใช้", 404);

  const body = await req.json();
  const parsed = userUpdateInputSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const data = parsed.data;

  const usernameTaken = await prisma.user.findFirst({ where: { username: data.username, id: { not: id } } });
  if (usernameTaken) return errorResponse("มีชื่อผู้ใช้นี้อยู่แล้ว", 409);

  if (target.role === "ADMIN" && data.role !== "ADMIN") {
    const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
    if (adminCount <= 1) {
      return errorResponse("ต้องมีผู้ดูแลระบบอย่างน้อย 1 คน", 400);
    }
  }

  const user = await prisma.user.update({
    where: { id },
    data: {
      name: data.name,
      username: data.username,
      role: data.role,
      ...(data.password ? { passwordHash: await bcrypt.hash(data.password, 10) } : {}),
    },
    select: { id: true, name: true, username: true, role: true, createdAt: true },
  });

  return NextResponse.json(user);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { session, response } = await requireAdmin();
  if (response) return response;

  const { id } = await params;

  if (id === session!.user.id) {
    return errorResponse("ไม่สามารถลบบัญชีของตัวเองได้", 400);
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return errorResponse("ไม่พบผู้ใช้", 404);

  if (target.role === "ADMIN") {
    const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
    if (adminCount <= 1) {
      return errorResponse("ต้องมีผู้ดูแลระบบอย่างน้อย 1 คน", 400);
    }
  }

  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
