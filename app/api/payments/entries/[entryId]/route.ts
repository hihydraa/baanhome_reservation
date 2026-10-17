import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWriteAccess, zodErrorResponse, errorResponse } from "@/lib/api-helpers";
import { paymentEntryUpdateInputSchema, deleteReasonInputSchema } from "@/lib/validators";
import { withDatePart } from "@/lib/dates";
import { logPaymentEntryChange, snapshotEntry } from "@/lib/payment-entry-log";

type Params = { params: Promise<{ entryId: string }> };

/** Loads the entry, or null when it doesn't exist or belongs to a soft-deleted booking. */
async function findLiveEntry(entryId: string) {
  const entry = await prisma.paymentEntry.findUnique({
    where: { id: entryId },
    include: {
      receivedBy: true,
      payment: {
        include: {
          accommodationBooking: { select: { deletedAt: true } },
          banquetBooking: { select: { deletedAt: true } },
        },
      },
    },
  });
  if (!entry || entry.payment.accommodationBooking?.deletedAt || entry.payment.banquetBooking?.deletedAt) return null;
  return entry;
}

const isReceiptCollision = (err: unknown) =>
  typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "P2002";

export async function PATCH(req: NextRequest, { params }: Params) {
  const { session, response } = await requireWriteAccess();
  if (response) return response;

  const { entryId } = await params;
  const existing = await findLiveEntry(entryId);
  if (!existing) return errorResponse("ไม่พบรายการชำระเงิน", 404);

  const body = await req.json();
  const parsed = paymentEntryUpdateInputSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const data = parsed.data;

  try {
    const entry = await prisma.$transaction(async (tx) => {
      const updated = await tx.paymentEntry.update({
        where: { id: entryId },
        data: {
          amount: data.amount,
          method: data.method,
          paidAt: withDatePart(existing.paidAt, data.paidAt),
          receivedById: data.receivedById || null,
          notes: data.notes,
          receiptNumber: data.receiptNumber || existing.receiptNumber,
        },
        include: { receivedBy: true },
      });
      await logPaymentEntryChange(tx, {
        action: "UPDATE",
        entryId,
        paymentId: existing.paymentId,
        receiptNumber: updated.receiptNumber,
        before: snapshotEntry(existing),
        after: snapshotEntry(updated),
        reason: data.reason,
        actor: session!.user,
      });
      return updated;
    });
    return NextResponse.json(entry);
  } catch (err) {
    if (isReceiptCollision(err)) return errorResponse("เลขที่ใบเสร็จนี้ถูกใช้ไปแล้ว กรุณาระบุเลขอื่น", 409);
    throw err;
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { session, response } = await requireWriteAccess();
  if (response) return response;

  const { entryId } = await params;
  const existing = await findLiveEntry(entryId);
  if (!existing) return errorResponse("ไม่พบรายการชำระเงิน", 404);

  const body = await req.json().catch(() => ({}));
  const parsed = deleteReasonInputSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  await prisma.$transaction(async (tx) => {
    await logPaymentEntryChange(tx, {
      action: "DELETE",
      entryId,
      paymentId: existing.paymentId,
      receiptNumber: existing.receiptNumber,
      before: snapshotEntry(existing),
      reason: parsed.data.reason,
      actor: session!.user,
    });
    await tx.paymentEntry.delete({ where: { id: entryId } });
  });
  return NextResponse.json({ ok: true });
}
