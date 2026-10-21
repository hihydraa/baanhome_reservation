import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PAYMENT_METHOD_LABELS } from "@/lib/labels";
import { shiftDate, todayDateOnly, toDateOnlyString } from "@/lib/dates";
import { accommodationExpectedTotal, sumPaid } from "@/lib/payment-calc";
import { reconcileNights, type NightIssue } from "@/lib/housekeeping-reconcile";

/** Loads the last `rangeDays` nights of bookings and cleaning records and reconciles them. */
export async function loadReconciliation(rangeDays: number) {
  const today = todayDateOnly();
  const lastNight = shiftDate(today, -1);
  const firstNight = shiftDate(today, -rangeDays);

  const [stays, records, rooms] = await Promise.all([
    // Every booking that overlaps the range — cancelled ones included, since "cancelled" is exactly what a room
    // that was really used might be hidden behind.
    prisma.accommodationBooking.findMany({
      where: { checkIn: { lte: today }, checkOut: { gt: firstNight } },
      select: {
        id: true,
        status: true,
        resourceId: true,
        customerName: true,
        checkIn: true,
        checkOut: true,
        roomPrice: true,
        discountType: true,
        discountValue: true,
        updatedAt: true,
        createdBy: { select: { name: true } },
        resource: { select: { name: true, price: true } },
        addons: { select: { quantity: true, price: true, description: true, service: { select: { name: true } } } },
        payment: { select: { entries: { select: { amount: true, method: true } } } },
      },
      orderBy: { checkIn: "desc" },
    }),
    prisma.cleaningRecord.findMany({
      where: { OR: [{ serviceDate: { gte: shiftDate(firstNight, -30), lte: today } }, { ledgerDate: { gte: firstNight, lte: today } }] },
      orderBy: { createdAt: "desc" },
      include: { items: true },
    }),
    prisma.resource.findMany({ where: { type: "ACCOMMODATION" }, select: { id: true, price: true } }),
  ]);

  // Who cancelled each cancelled booking, when, and why (the booking row itself only keeps the status).
  const cancelledIds = stays.filter((st) => st.status === "CANCELLED").map((st) => st.id);
  const cancelLogs = cancelledIds.length
    ? await prisma.cancellationLog.findMany({
        where: { bookingType: "ACCOMMODATION", action: "CANCEL", bookingId: { in: cancelledIds } },
        orderBy: { cancelledAt: "desc" },
        select: { bookingId: true, cancelledAt: true, reason: true, cancelledBy: { select: { name: true } } },
      })
    : [];
  const cancelByBooking = new Map<string, (typeof cancelLogs)[number]>();
  for (const c of cancelLogs) if (!cancelByBooking.has(c.bookingId)) cancelByBooking.set(c.bookingId, c);

  // Last night first.
  const nights = Array.from({ length: rangeDays }, (_, i) => shiftDate(lastNight, -i));
  const recon = reconcileNights({
    nights,
    today,
    resourceRates: Object.fromEntries(rooms.map((r) => [r.id, r.price ? Number(r.price) : 0])),
    bookings: stays.map((st) => {
      const entries = st.payment?.entries ?? [];
      const cancel = cancelByBooking.get(st.id);
      const cancelled = st.status === "CANCELLED";
      return {
        id: st.id,
        resourceId: st.resourceId,
        roomName: st.resource.name,
        customerName: st.customerName,
        checkIn: st.checkIn,
        checkOut: st.checkOut,
        status: st.status,
        roomRate: Number(st.roomPrice ?? st.resource.price ?? 0),
        expectedTotal: accommodationExpectedTotal(st, st.addons).expectedTotal,
        paid: sumPaid(entries),
        payMethods: [...new Set(entries.map((e) => PAYMENT_METHOD_LABELS[e.method] ?? e.method))],
        createdByName: st.createdBy?.name ?? null,
        // A booking cancelled with no log row (older data) falls back to its last edit time.
        cancelledAt: cancelled ? (cancel?.cancelledAt ?? st.updatedAt) : null,
        cancelledByName: cancelled ? (cancel?.cancelledBy?.name ?? null) : null,
        cancelReason: cancelled ? (cancel?.reason ?? null) : null,
      };
    }),
    records: records.map((r) => ({
      id: r.id,
      resourceId: r.resourceId,
      roomName: r.roomName,
      type: r.type,
      ledgerDate: r.ledgerDate,
      createdAt: r.createdAt,
    })),
  });

  return { today, lastNight, firstNight, nights, stays, records, cancelByBooking, recon };
}

/** Payment findings belong to the booking, not to a night — the night they were attached to depends on the window. */
const BOOKING_LEVEL_KINDS = new Set(["NO_PAYMENT", "UNDERPAID"]);

export function findingKey(i: Pick<NightIssue, "kind" | "bookingId" | "resourceId" | "night">): string {
  if (BOOKING_LEVEL_KINDS.has(i.kind) && i.bookingId) return `${i.kind}:${i.bookingId}`;
  return `${i.kind}:${i.bookingId ?? i.resourceId}:${toDateOnlyString(i.night)}`;
}

/**
 * Saves today's high/medium findings, so they survive later edits to the bookings, and flags the ones an earlier
 * check found that no longer reproduce (vanishedAt) — the data was changed after detection. Run daily by cron and
 * on every view of the audit page; saving the same finding twice is a no-op.
 */
export async function syncAuditFindings(recon: Awaited<ReturnType<typeof loadReconciliation>>["recon"], nights: Date[]) {
  const live = new Map<string, NightIssue>();
  for (const n of recon) {
    for (const i of n.issues) if (i.severity === "HIGH" || i.severity === "MEDIUM") live.set(findingKey(i), i);
  }

  if (live.size > 0) {
    await prisma.auditFinding.createMany({
      data: [...live].map(([key, i]) => ({
        key,
        kind: i.kind,
        severity: i.severity,
        night: i.night,
        resourceId: i.resourceId,
        roomName: i.roomName,
        bookingId: i.bookingId,
        customerName: i.customerName,
        detail: i.detail,
        amount: i.amount != null ? new Prisma.Decimal(i.amount) : null,
        responsible: i.responsible ?? null,
      })),
      skipDuplicates: true,
    });
    // Reproduced again after having vanished.
    await prisma.auditFinding.updateMany({ where: { key: { in: [...live.keys()] }, vanishedAt: { not: null } }, data: { vanishedAt: null } });
  }

  // Only findings whose night this run actually examined can be judged as gone.
  const times = nights.map((n) => n.getTime());
  const stored = await prisma.auditFinding.findMany({
    where: { vanishedAt: null, night: { gte: new Date(Math.min(...times)), lte: new Date(Math.max(...times)) } },
    select: { id: true, key: true },
  });
  const gone = stored.filter((f) => !live.has(f.key)).map((f) => f.id);
  if (gone.length > 0) await prisma.auditFinding.updateMany({ where: { id: { in: gone } }, data: { vanishedAt: new Date() } });
}
