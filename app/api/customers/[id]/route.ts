import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWriteAccess, zodErrorResponse, errorResponse } from "@/lib/api-helpers";
import { customerInputSchema } from "@/lib/validators";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { response } = await requireWriteAccess();
  if (response) return response;

  const { id } = await params;
  const existing = await prisma.customer.findUnique({ where: { id } });
  if (!existing) return errorResponse("ไม่พบลูกค้ารายนี้", 404);

  const body = await req.json();
  const parsed = customerInputSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const data = parsed.data;

  const nameTaken = await prisma.customer.findFirst({ where: { name: data.name.trim(), id: { not: id } } });
  if (nameTaken) return errorResponse("มีลูกค้าชื่อนี้อยู่แล้ว", 409);

  const customer = await prisma.customer.update({
    where: { id },
    data: { name: data.name.trim(), phone: data.phone || null, taxId: data.taxId || null },
  });
  return NextResponse.json(customer);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { response } = await requireWriteAccess();
  if (response) return response;

  const { id } = await params;
  const existing = await prisma.customer.findUnique({ where: { id } });
  if (!existing) return errorResponse("ไม่พบลูกค้ารายนี้", 404);

  await prisma.customer.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
