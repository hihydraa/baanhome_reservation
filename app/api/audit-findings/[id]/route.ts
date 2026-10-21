import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { errorResponse, zodErrorResponse } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string }> };

const inputSchema = z.object({
  status: z.enum(["OPEN", "CLEARED", "CONFIRMED"]),
  note: z.string().trim().max(500).optional(),
});

/** ADMIN / AUDITOR set the outcome of a finding. Closing it either way needs a written reason. */
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "AUDITOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = inputSchema.safeParse(await req.json());
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const { status, note } = parsed.data;
  if (status !== "OPEN" && (note?.length ?? 0) < 3) return errorResponse("กรุณาระบุเหตุผล (อย่างน้อย 3 ตัวอักษร)");

  const { id } = await params;
  const existing = await prisma.auditFinding.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return errorResponse("ไม่พบรายการ", 404);

  const finding = await prisma.auditFinding.update({
    where: { id },
    data: {
      status,
      note: status === "OPEN" ? null : note,
      reviewedById: status === "OPEN" ? null : session.user.id,
      reviewedByName: status === "OPEN" ? null : (session.user.name ?? session.user.username),
      reviewedAt: status === "OPEN" ? null : new Date(),
    },
  });
  return NextResponse.json({ id: finding.id, status: finding.status });
}
