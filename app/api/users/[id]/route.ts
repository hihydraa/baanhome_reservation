import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, errorResponse } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string }> };

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
