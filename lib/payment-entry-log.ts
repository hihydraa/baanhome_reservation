import type { Prisma, PaymentEntryAction } from "@prisma/client";
import type { AppPrismaClient } from "@/lib/prisma";
import { formatThaiDate } from "@/lib/dates";

/** The app client or a transaction client from it. */
type Db = Pick<AppPrismaClient, "payment" | "paymentEntryLog">;

/** The fields of a PaymentEntry that matter for audit — stored as JSON before/after. */
export type PaymentEntrySnapshot = {
  amount: number;
  method: string;
  paidAt: string;
  receivedById: string | null;
  receivedByName: string | null;
  notes: string | null;
  receiptNumber: string;
};

type EntryLike = {
  amount: Prisma.Decimal | number;
  method: string;
  paidAt: Date;
  receivedById: string | null;
  receivedBy?: { name: string } | null;
  notes: string | null;
  receiptNumber: string;
};

export function snapshotEntry(entry: EntryLike): PaymentEntrySnapshot {
  return {
    amount: Number(entry.amount),
    method: entry.method,
    paidAt: entry.paidAt.toISOString(),
    receivedById: entry.receivedById,
    receivedByName: entry.receivedBy?.name ?? null,
    notes: entry.notes,
    receiptNumber: entry.receiptNumber,
  };
}

export type Actor = { id: string; name?: string | null; username?: string | null };

/** Which booking a payment belongs to, read straight through the relation (so it still resolves
 *  for a soft-deleted booking — nested includes are not filtered). */
async function describePayment(db: Db, paymentId: string) {
  const payment = await db.payment.findUnique({
    where: { id: paymentId },
    include: {
      accommodationBooking: { include: { resource: true } },
      banquetBooking: { include: { resource: true } },
    },
  });
  if (payment?.accommodationBooking) {
    const b = payment.accommodationBooking;
    return {
      bookingType: "ACCOMMODATION" as const,
      bookingId: b.id,
      bookingLabel: `${b.resource.name} — ${b.customerName} (${formatThaiDate(b.checkIn)} - ${formatThaiDate(b.checkOut)})`,
    };
  }
  if (payment?.banquetBooking) {
    const b = payment.banquetBooking;
    return {
      bookingType: "BANQUET" as const,
      bookingId: b.id,
      bookingLabel: `${b.resource.name} — ${b.customerName} (${formatThaiDate(b.eventDate)})`,
    };
  }
  return { bookingType: null, bookingId: null, bookingLabel: "-" };
}

/**
 * Append one row to PaymentEntryLog. Pass the transaction client the money change runs in, so
 * the change and its audit row are saved together or not at all — an edit/delete can never
 * slip through without a trace.
 */
export async function logPaymentEntryChange(db: Db, params: {
  action: PaymentEntryAction;
  entryId: string;
  paymentId: string;
  receiptNumber: string;
  before?: PaymentEntrySnapshot | null;
  after?: PaymentEntrySnapshot | null;
  reason?: string | null;
  actor: Actor;
}) {
  const booking = await describePayment(db, params.paymentId);
  await db.paymentEntryLog.create({
    data: {
      action: params.action,
      entryId: params.entryId,
      paymentId: params.paymentId,
      receiptNumber: params.receiptNumber,
      ...booking,
      before: params.before ?? undefined,
      after: params.after ?? undefined,
      reason: params.reason || null,
      userId: params.actor.id,
      userName: params.actor.name || params.actor.username || "-",
    },
  });
}

/** Log a CREATE row for each entry created inline with a new booking (initial deposit). */
export async function logCreatedEntries(
  db: Db,
  entries: (EntryLike & { id: string; paymentId: string })[],
  actor: Actor
) {
  for (const e of entries) {
    await logPaymentEntryChange(db, {
      action: "CREATE",
      entryId: e.id,
      paymentId: e.paymentId,
      receiptNumber: e.receiptNumber,
      after: snapshotEntry(e),
      actor,
    });
  }
}
