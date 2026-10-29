import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PAYMENT_METHOD_LABELS } from "@/lib/labels";
import { AMOUNT_KEYS, TRACKED_ITEMS, TRACKED_LABELS, trackedKeyForAddonName, type TrackedKey } from "@/lib/housekeeping";
import { takenUnits } from "@/lib/housekeeping-billing";
import { shiftDate, todayDateOnly, toDateOnlyString } from "@/lib/dates";
import { accommodationExpectedTotal, sumPaid } from "@/lib/payment-calc";
import { ISSUE_SEVERITY, reconcileNights, type NightIssue } from "@/lib/housekeeping-reconcile";

/**
 * Loads bookings and cleaning records for a range of nights and reconciles them. The range is either the last
 * `n` nights, or an explicit first and last night (ledger dates; the last night can't be later than last night).
 */
export async function loadReconciliation(range: number | { from: Date; to: Date }) {
  const today = todayDateOnly();
  const yesterday = shiftDate(today, -1);
  const lastNight = typeof range === "number" ? yesterday : range.to > yesterday ? yesterday : range.to;
  const firstNight = typeof range === "number" ? shiftDate(today, -range) : range.from > lastNight ? lastNight : range.from;
  const rangeDays = Math.round((lastNight.getTime() - firstNight.getTime()) / 86_400_000) + 1;

  const [stays, records, rooms] = await Promise.all([
    // Every booking that overlaps the range — cancelled ones included, since "cancelled" is exactly what a room
    // that was really used might be hidden behind.
    prisma.accommodationBooking.findMany({
      where: { checkIn: { lte: today }, checkOut: { gt: firstNight } },
      select: {
        id: true,
        status: true,
        charterGroupId: true,
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
        groupId: st.charterGroupId,
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

  // Services the housekeeper saw delivered (extra bed, blanket, pillow, pet) that the booking was never charged for.
  const services = await prisma.specialService.findMany({ where: { scope: "ACCOMMODATION" }, select: { name: true, price: true } });
  const priceFor = (cat: string) => {
    const t = TRACKED_ITEMS.find((x) => x.key === cat);
    const sv = t && services.find((v) => t.keywords.some((k) => v.name.includes(k)));
    return sv ? Number(sv.price) : 0;
  };
  const finished = stays.filter((st) => st.status !== "CANCELLED" && st.checkOut < today);
  const units = new Map<string, typeof finished>();
  for (const st of finished) units.set(st.charterGroupId ?? st.id, [...(units.get(st.charterGroupId ?? st.id) ?? []), st]);
  for (const [unitKey, members] of units) {
    // A charter is billed on one room but served in many: add-ons are compared across the whole group.
    const billed = new Map<string, number>();
    const taken = new Map<string, { qty: number; resourceId: string; roomName: string }>();
    for (const st of members) {
      for (const a of st.addons) {
        const cat = trackedKeyForAddonName(a.service?.name ?? a.description);
        if (cat) billed.set(cat, (billed.get(cat) ?? 0) + (AMOUNT_KEYS.includes(cat) ? Number(a.price) * a.quantity : a.quantity));
      }
      // Per room: services are charged once per stay (hours are added up), so count units as the billing does.
      const rows = new Map<string, { recordId: string; quantity: number }[]>();
      for (const r of records) {
        if (r.resourceId !== st.resourceId || r.ledgerDate < st.checkIn || r.ledgerDate >= st.checkOut) continue;
        for (const i of r.items) {
          if (!i.category) continue;
          rows.set(i.category, [...(rows.get(i.category) ?? []), { recordId: r.id, quantity: i.quantity }]);
        }
      }
      for (const [cat, list] of rows) {
        const cur = taken.get(cat) ?? { qty: 0, resourceId: st.resourceId, roomName: st.resource.name };
        cur.qty += takenUnits(cat as TrackedKey, list);
        taken.set(cat, cur);
      }
    }
    const anchor = members[0];
    const night = shiftDate(anchor.checkOut, -1);
    const target = recon.find((n) => n.night.getTime() === night.getTime());
    if (!target) continue;
    for (const [cat, t] of taken) {
      const missing = t.qty - (billed.get(cat) ?? 0);
      if (missing <= 0) continue;
      const asAmount = AMOUNT_KEYS.includes(cat);
      const price = asAmount ? 1 : priceFor(cat);
      target.issues.push({
        kind: "UNBILLED_ADDON",
        severity: ISSUE_SEVERITY.UNBILLED_ADDON,
        night,
        resourceId: t.resourceId,
        roomName: t.roomName,
        bookingId: anchor.id,
        customerName: anchor.customerName,
        detail: asAmount
          ? `${TRACKED_LABELS[cat] ?? cat}: แม่บ้านบันทึก ${t.qty.toLocaleString("th-TH")} บาท บันทึกในการจอง ${(billed.get(cat) ?? 0).toLocaleString("th-TH")} บาท`
          : `${TRACKED_LABELS[cat] ?? cat}: แม่บ้านเบิก ${t.qty} บันทึกในการจอง ${billed.get(cat) ?? 0}${price ? ` (บริการละ ${price.toLocaleString("th-TH")} บาท)` : ""}`,
        amount: missing * price,
        responsible: anchor.createdBy?.name ?? null,
        groupId: anchor.charterGroupId,
        key: `UNBILLED_ADDON:${unitKey}:${cat}`,
      });
    }
  }

  return { today, lastNight, firstNight, nights, stays, records, cancelByBooking, recon };
}

/** Payment findings belong to the booking, not to a night — the night they were attached to depends on the window. */
const BOOKING_LEVEL_KINDS = new Set(["NO_PAYMENT", "UNDERPAID"]);

export function findingKey(i: Pick<NightIssue, "kind" | "bookingId" | "resourceId" | "night" | "groupId" | "key">): string {
  if (i.key) return i.key;
  if (BOOKING_LEVEL_KINDS.has(i.kind) && (i.groupId ?? i.bookingId)) return `${i.kind}:${i.groupId ?? i.bookingId}`;
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
