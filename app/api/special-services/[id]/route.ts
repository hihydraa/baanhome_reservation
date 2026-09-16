import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWriteAccess, zodErrorResponse, errorResponse } from "@/lib/api-helpers";
import { specialServiceInputSchema } from "@/lib/validators";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { response } = await requireWriteAccess();
  if (response) return response;

  const { id } = await params;
  const existing = await prisma.specialService.findUnique({ where: { id } });
  if (!existing) return errorResponse("ไม่พบบริการนี้", 404);

  const body = await req.json();
  const parsed = specialServiceInputSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const data = parsed.data;

  const nameTaken = await prisma.specialService.findFirst({
    where: { name: data.name, id: { not: id } },
  });
  if (nameTaken) return errorResponse("มีบริการนี้อยู่แล้ว", 409);

  const service = await prisma.specialService.update({ where: { id }, data });
  return NextResponse.json(service);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { response } = await requireWriteAccess();
  if (response) return response;

  const { id } = await params;
  const existing = await prisma.specialService.findUnique({ where: { id } });
  if (!existing) return errorResponse("ไม่พบบริการนี้", 404);

  await prisma.specialService.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
