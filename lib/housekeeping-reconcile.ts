/**
 * Reconciles housekeeping against bookings, per room-night — with the housekeeper's log as the evidence.
 *
 * The cashier's records (status, cancellations, payments) can be incomplete or wrong, so they are the thing
 * being tested, not the source of truth. The cleaning log is dated by the night being cleaned up (the
 * "ledger date" D): the morning cleaning on D+1 belongs to the stay of night D. A cleaning record for room R
 * on night D is therefore evidence that R was used that night, and the night must be backed by:
 *   1. a booking covering D that is not cancelled,
 *   2. a payment toward that booking once the stay is over.
 * Booking *status* (reserved / checked-in / checked-out) is deliberately not trusted: a stale status is only a
 * low-severity data-quality note, never a revenue concern on its own.
 *
 * Nights whose checkout morning is today are "pending": the cleaning may still come later today.
 */

export type ReconBooking = {
  id: string;
  resourceId: string;
  roomName: string;
  customerName: string;
  checkIn: Date;
  checkOut: Date;
  status: "RESERVED" | "CHECKED_IN" | "CHECKED_OUT" | "CANCELLED";
  /** Price per night (the booking's own, else the room's list price); 0 when unknown. */
  roomRate: number;
  /** Net payable incl. add-ons and discount. */
  expectedTotal: number;
  paid: number;
  payMethods: string[];
  createdByName: string | null;
  /** Rooms booked together as one charter share this id; their payment sits on one room, so money is judged per group. */
  groupId: string | null;
  /** Only for cancelled bookings. */
  cancelledAt: Date | null;
  cancelledByName: string | null;
  cancelReason: string | null;
};

export type ReconRecord = {
  id: string;
  resourceId: string;
  roomName: string;
  type: "CHECKOUT" | "STAY";
  ledgerDate: Date;
  /** When the housekeeper actually saved it (a real instant). */
  createdAt: Date;
};

export type IssueKind =
  | "USED_NO_BOOKING"
  | "USED_CANCELLED"
  | "UNRECORDED_EXTENSION"
  | "NO_PAYMENT"
  | "UNDERPAID"
  | "MISSING_CHECKOUT"
  | "STATUS_LAG_RESERVED"
  | "STATUS_LAG_CHECKED_IN"
  | "CHECKOUT_BUT_STAYING"
  | "STAY_BUT_CHECKOUT"
  | "DUPLICATE_CHECKOUT"
  | "PENDING_CHECKOUT"
  | "NEVER_CHECKED_IN"
  | "UNBILLED_ADDON";

export type Severity = "HIGH" | "MEDIUM" | "LOW" | "INFO";

export const ISSUE_LABELS: Record<IssueKind, string> = {
  USED_NO_BOOKING: "ห้องถูกใช้ แต่ไม่มีการจองในระบบ",
  USED_CANCELLED: "ห้องถูกใช้ แต่การจองถูกยกเลิก",
  UNRECORDED_EXTENSION: "ห้องถูกใช้เลยวันเช็คเอาท์ในการจอง (พักต่อที่ไม่ได้บันทึก)",
  NO_PAYMENT: "พักเสร็จแล้ว แต่ไม่มีบันทึกรับเงิน",
  UNDERPAID: "พักเสร็จแล้ว แต่รับเงินไม่ครบยอด",
  MISSING_CHECKOUT: "ลูกค้าเช็คเอาท์ แต่แม่บ้านไม่มีบันทึกทำความสะอาด",
  STATUS_LAG_RESERVED: "ห้องถูกใช้ แต่สถานะการจองยังเป็น \"จอง\"",
  STATUS_LAG_CHECKED_IN: "พักเสร็จแล้ว แต่สถานะการจองยังเป็น \"เข้าพัก\"",
  CHECKOUT_BUT_STAYING: "แม่บ้านบันทึกเป็นเช็คเอาท์ แต่การจองยังพักต่อ",
  STAY_BUT_CHECKOUT: "แม่บ้านบันทึกเป็นพักต่อ แต่การจองเช็คเอาท์",
  DUPLICATE_CHECKOUT: "บันทึกเช็คเอาท์ซ้ำหลายรายการ",
  PENDING_CHECKOUT: "เช็คเอาท์วันนี้ รอทำความสะอาด",
  NEVER_CHECKED_IN: "การจองยังเป็นสถานะ \"จอง\" และไม่มีหลักฐานการใช้ห้อง (ไม่มาพัก?)",
  UNBILLED_ADDON: "แม่บ้านเบิก/พบบริการเสริม แต่ไม่ได้บันทึกในการจอง",
};

export const ISSUE_SEVERITY: Record<IssueKind, Severity> = {
  USED_NO_BOOKING: "HIGH",
  USED_CANCELLED: "HIGH",
  UNRECORDED_EXTENSION: "HIGH",
  NO_PAYMENT: "HIGH",
  UNDERPAID: "MEDIUM",
  MISSING_CHECKOUT: "MEDIUM",
  STATUS_LAG_RESERVED: "LOW",
  STATUS_LAG_CHECKED_IN: "LOW",
  CHECKOUT_BUT_STAYING: "LOW",
  STAY_BUT_CHECKOUT: "LOW",
  DUPLICATE_CHECKOUT: "LOW",
  PENDING_CHECKOUT: "INFO",
  NEVER_CHECKED_IN: "INFO",
  UNBILLED_ADDON: "MEDIUM",
};

export const SEVERITY_LABELS: Record<Severity, string> = {
  HIGH: "สูง",
  MEDIUM: "กลาง",
  LOW: "ต่ำ",
  INFO: "ข้อมูล",
};

export const SEVERITY_ORDER: Severity[] = ["HIGH", "MEDIUM", "LOW", "INFO"];

export type NightIssue = {
  kind: IssueKind;
  severity: Severity;
  night: Date;
  resourceId: string;
  roomName: string;
  bookingId?: string;
  customerName?: string;
  recordId?: string;
  detail?: string;
  /** Estimated baht not backed by a recorded payment. */
  amount?: number;
  /** The staff member whose entry the finding traces back to; null when no booking exists to trace. */
  responsible?: string | null;
  /** Charter group of the booking, so one payment shortfall is a single finding however many rooms it spans. */
  groupId?: string | null;
  /** Overrides the stable key (used by findings that are per booking and item rather than per night). */
  key?: string;
};

export type NightResult = {
  night: Date;
  /** Rooms the housekeeper's log says were used that night. */
  evidence: number;
  /** Of those, rooms covered by a booking that is not cancelled. */
  backed: number;
  /** Rooms whose guest checked out on the morning after (per bookings). */
  checkouts: number;
  /** Of those, rooms with a "guest checked out" cleaning logged. */
  checkoutCleaned: number;
  /** "Guest staying on" cleanings (requested by the guest). */
  stayCleans: number;
  issues: NightIssue[];
};

const DAY_MS = 86_400_000;
const key = (d: Date) => Math.round(d.getTime() / DAY_MS);

function fmtInstant(d: Date): string {
  return d.toLocaleString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short" });
}

function fmtDay(d: Date): string {
  return d.toLocaleDateString("th-TH", { timeZone: "UTC", day: "numeric", month: "short", year: "2-digit" });
}

const baht = (n: number) => `${Math.round(n).toLocaleString("th-TH")} บาท`;

export function reconcileNights(input: {
  nights: Date[];
  today: Date;
  bookings: ReconBooking[];
  records: ReconRecord[];
  /** List price per night by resource, used to value a used night that has no booking. */
  resourceRates: Record<string, number>;
}): NightResult[] {
  const active = input.bookings.filter((b) => b.status !== "CANCELLED");
  const cancelled = input.bookings.filter((b) => b.status === "CANCELLED");
  const todayKey = key(input.today);
  // A charter is paid once, on one room: money is judged for the whole group, never room by room.
  const nightsOf = (b: ReconBooking) => Math.max(1, key(b.checkOut) - key(b.checkIn));
  const expectedOf = (b: ReconBooking) => (b.expectedTotal > 0 ? b.expectedTotal : b.roomRate * nightsOf(b));
  const groups = new Map<string, { paid: number; expected: number; expectedKnown: boolean; rooms: number }>();
  for (const b of active) {
    if (!b.groupId) continue;
    const g = groups.get(b.groupId) ?? { paid: 0, expected: 0, expectedKnown: false, rooms: 0 };
    g.paid += b.paid;
    g.expected += expectedOf(b);
    g.expectedKnown ||= b.expectedTotal > 0;
    g.rooms += 1;
    groups.set(b.groupId, g);
  }
  // Booking-level findings (payment, stale status) are raised once, not once per night of the stay.
  const flagged = new Set<string>();

  return input.nights.map((night) => {
    const d = key(night);
    const issues: NightIssue[] = [];
    const push = (i: Omit<NightIssue, "severity">) => issues.push({ ...i, severity: ISSUE_SEVERITY[i.kind] });

    const covers = (b: ReconBooking) => key(b.checkIn) <= d && d < key(b.checkOut);
    const occupiedBookings = active.filter(covers);
    const checkingOut = occupiedBookings.filter((b) => key(b.checkOut) === d + 1);
    const checkingOutRooms = new Set(checkingOut.map((b) => b.resourceId));

    const recs = input.records.filter((r) => key(r.ledgerDate) === d);
    const checkoutRecs = recs.filter((r) => r.type === "CHECKOUT");
    const stayRecs = recs.filter((r) => r.type === "STAY");
    const cleanedRooms = new Set(checkoutRecs.map((r) => r.resourceId));

    const evidenceByRoom = new Map<string, ReconRecord[]>();
    for (const r of recs) evidenceByRoom.set(r.resourceId, [...(evidenceByRoom.get(r.resourceId) ?? []), r]);

    // ----- payment: every finished stay must have been paid for, whether or not housekeeping logged a cleaning -----
    for (const b of checkingOut) {
      // Judged on the stay's last night, and only once the stay is over (the guest may still pay at checkout).
      if (key(b.checkOut) >= todayKey) continue;
      const g = b.groupId ? groups.get(b.groupId) : undefined;
      const paid = g ? g.paid : b.paid;
      const expected = g ? g.expected : expectedOf(b);
      const expectedKnown = g ? g.expectedKnown : b.expectedTotal > 0;
      const scope = g && g.rooms > 1 ? `ห้องเหมา ${g.rooms} ห้อง รวมยอด; ` : "";
      const methods = b.payMethods.length > 0 ? ` (${b.payMethods.join(", ")})` : "";
      const bBase = { night, resourceId: b.resourceId, roomName: b.roomName, bookingId: b.id, customerName: b.customerName, responsible: b.createdByName, groupId: b.groupId };
      const onceKey = (kind: IssueKind) => `${b.groupId ?? b.id}:${kind}`;
      if (paid <= 0) {
        if (!flagged.has(onceKey("NO_PAYMENT"))) {
          flagged.add(onceKey("NO_PAYMENT"));
          push({ ...bBase, kind: "NO_PAYMENT", detail: `${scope}ยอดที่ควรได้ ${expected > 0 ? baht(expected) : "ไม่ระบุ"}; รับแล้ว 0`, amount: expected });
        }
      } else if (expectedKnown && paid < expected - 0.5 && !flagged.has(onceKey("UNDERPAID"))) {
        flagged.add(onceKey("UNDERPAID"));
        push({ ...bBase, kind: "UNDERPAID", detail: `${scope}ยอดที่ควรได้ ${baht(expected)}; รับแล้ว ${baht(paid)}${methods}`, amount: expected - paid });
      }
    }

    // ----- evidence first: every room the housekeeper says was used must be backed by revenue records -----
    let backed = 0;
    for (const [resourceId, rs] of evidenceByRoom) {
      const first = [...rs].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
      const roomName = first.roomName;
      const base = { night, resourceId, roomName, recordId: first.id };
      const cover = occupiedBookings.filter((b) => b.resourceId === resourceId);

      if (cover.length === 0) {
        const rate = input.resourceRates[resourceId] ?? 0;
        const cancelledCover = cancelled
          .filter((b) => b.resourceId === resourceId && covers(b))
          .sort((a, b) => (b.cancelledAt?.getTime() ?? 0) - (a.cancelledAt?.getTime() ?? 0))[0];
        const extendedFrom = active.find((b) => b.resourceId === resourceId && key(b.checkOut) === d);

        if (cancelledCover) {
          const when = cancelledCover.cancelledAt
            ? cancelledCover.cancelledAt.getTime() > first.createdAt.getTime()
              ? `ยกเลิกเมื่อ ${fmtInstant(cancelledCover.cancelledAt)} ซึ่งหลังแม่บ้านบันทึกทำความสะอาด (${fmtInstant(first.createdAt)})`
              : `ยกเลิกเมื่อ ${fmtInstant(cancelledCover.cancelledAt)} ก่อนแม่บ้านบันทึกทำความสะอาด (${fmtInstant(first.createdAt)})`
            : "ไม่พบเวลายกเลิกในประวัติ";
          push({
            ...base,
            kind: "USED_CANCELLED",
            bookingId: cancelledCover.id,
            customerName: cancelledCover.customerName,
            detail: `${cancelledCover.cancelledByName ? `ยกเลิกโดย ${cancelledCover.cancelledByName}` : "ไม่ทราบผู้ยกเลิก"}; ${when}${
              cancelledCover.cancelReason ? `; เหตุผล: ${cancelledCover.cancelReason}` : "; ไม่ได้ระบุเหตุผล"
            }`,
            amount: cancelledCover.roomRate || rate,
            responsible: cancelledCover.cancelledByName ?? cancelledCover.createdByName,
          });
        } else if (extendedFrom) {
          push({
            ...base,
            kind: "UNRECORDED_EXTENSION",
            bookingId: extendedFrom.id,
            customerName: extendedFrom.customerName,
            detail: `การจองสิ้นสุดวันที่ ${fmtDay(extendedFrom.checkOut)} แต่แม่บ้านบันทึกว่าห้องมีผู้พักคืนวันที่ ${fmtDay(night)}`,
            amount: extendedFrom.roomRate || rate,
            responsible: extendedFrom.createdByName,
          });
        } else {
          push({
            ...base,
            kind: "USED_NO_BOOKING",
            detail: "ไม่พบการจองที่ครอบคลุมคืนนี้ (รวมที่ยกเลิก)",
            amount: rate,
            responsible: null,
          });
        }
        continue;
      }

      backed++;
      for (const b of cover) {
        const bBase = { night, resourceId, roomName, bookingId: b.id, customerName: b.customerName, responsible: b.createdByName };
        const once = (kind: IssueKind) => {
          const k = `${b.id}:${kind}`;
          if (flagged.has(k)) return false;
          flagged.add(k);
          return true;
        };

        if (b.status === "RESERVED" && once("STATUS_LAG_RESERVED")) {
          push({ ...bBase, kind: "STATUS_LAG_RESERVED" });
        } else if (b.status === "CHECKED_IN" && key(b.checkOut) < todayKey && once("STATUS_LAG_CHECKED_IN")) {
          push({ ...bBase, kind: "STATUS_LAG_CHECKED_IN" });
        }
      }
    }

    // ----- the housekeeper's own records must agree with each other and with the booking dates -----
    for (const b of checkingOut) {
      const base = { night, resourceId: b.resourceId, roomName: b.roomName, bookingId: b.id, customerName: b.customerName, responsible: b.createdByName };
      if (cleanedRooms.has(b.resourceId)) continue;
      if (b.status === "RESERVED" && !evidenceByRoom.has(b.resourceId)) {
        // A booking nobody checked in and nobody cleaned: the room may never have been used.
        push({ ...base, kind: "NEVER_CHECKED_IN" });
      } else {
        push({ ...base, kind: key(b.checkOut) >= todayKey ? "PENDING_CHECKOUT" : "MISSING_CHECKOUT" });
      }
    }

    const seen = new Map<string, number>();
    for (const r of checkoutRecs) {
      seen.set(r.resourceId, (seen.get(r.resourceId) ?? 0) + 1);
      const stillStaying = occupiedBookings.some((b) => b.resourceId === r.resourceId) && !checkingOutRooms.has(r.resourceId);
      if (stillStaying) push({ kind: "CHECKOUT_BUT_STAYING", night, resourceId: r.resourceId, roomName: r.roomName, recordId: r.id });
    }
    for (const [resourceId, n] of seen) {
      if (n > 1) {
        const r = checkoutRecs.find((x) => x.resourceId === resourceId)!;
        push({ kind: "DUPLICATE_CHECKOUT", night, resourceId, roomName: r.roomName, recordId: r.id });
      }
    }
    for (const r of stayRecs) {
      if (checkingOutRooms.has(r.resourceId)) push({ kind: "STAY_BUT_CHECKOUT", night, resourceId: r.resourceId, roomName: r.roomName, recordId: r.id });
    }

    return {
      night,
      evidence: evidenceByRoom.size,
      backed,
      checkouts: checkingOutRooms.size,
      checkoutCleaned: [...checkingOutRooms].filter((id) => cleanedRooms.has(id)).length,
      stayCleans: stayRecs.length,
      issues,
    };
  });
}
