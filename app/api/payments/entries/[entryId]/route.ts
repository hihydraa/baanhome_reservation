import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWriteAccess, zodErrorResponse, errorResponse } from "@/lib/api-helpers";
import { paymentEntryInputSchema } from "@/lib/validators";
import { withDatePart } from "@/lib/dates";

type Params = { params: Promise<{ entryId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { response } = await requireWriteAccess();
  if (response) return response;

  const { entryId } = await params;
  const existing = await prisma.paymentEntry.findUnique({ where: { id: entryId } });
  if (!existing) return errorResponse("ไม่พบรายการชำระเงิน", 404);

  const body = await req.json();
  const parsed = paymentEntryInputSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const data = parsed.data;

  const entry = await prisma.paymentEntry.update({
    where: { id: entryId },
    data: {
      amount: data.amount,
      method: data.method,
      paidAt: withDatePart(existing.paidAt, data.paidAt),
      receivedById: data.receivedById || null,
      notes: data.notes,
    },
    include: { receivedBy: true },
  });

  return NextResponse.json(entry);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { response } = await requireWriteAccess();
  if (response) return response;

  const { entryId } = await params;
  const existing = await prisma.paymentEntry.findUnique({ where: { id: entryId } });
  if (!existing) return errorResponse("ไม่พบรายการชำระเงิน", 404);

  await prisma.paymentEntry.delete({ where: { id: entryId } });
  return NextResponse.json({ ok: true });
}
