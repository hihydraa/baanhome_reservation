/**
 * Reconciles housekeeping against bookings, per room-night.
 *
 * The cleaning log is dated by the night being cleaned up (the "ledger date" D): the morning
 * cleaning on D+1 belongs to the stay of night D. So for a night D:
 *  - a booking checking out on D+1 should have exactly one "guest checked out" cleaning logged under D;
 *  - "guest staying on" cleanings happen only when the guest asks, so they are never required — they are
 *    only checked for making sense (the room was occupied that night and is not the checkout one).
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
};

export type ReconRecord = {
  id: string;
  resourceId: string;
  roomName: string;
  type: "CHECKOUT" | "STAY";
  ledgerDate: Date;
};

export type IssueKind =
  | "MISSING_CHECKOUT"
  | "PENDING_CHECKOUT"
  | "NEVER_CHECKED_IN"
  | "CHECKOUT_BUT_STAYING"
  | "CHECKOUT_BUT_EMPTY"
  | "STAY_BUT_CHECKOUT"
  | "STAY_BUT_EMPTY"
  | "DUPLICATE_CHECKOUT";

export const ISSUE_LABELS: Record<IssueKind, string> = {
  MISSING_CHECKOUT: "ลูกค้าเช็คเอาท์ แต่ไม่มีบันทึกทำความสะอาด",
  PENDING_CHECKOUT: "เช็คเอาท์วันนี้ รอทำความสะอาด",
  NEVER_CHECKED_IN: "การจองยังเป็นสถานะ \"จอง\" (ไม่ได้เช็คอิน?)",
  CHECKOUT_BUT_STAYING: "บันทึกเป็นเช็คเอาท์ แต่ลูกค้ายังพักต่อ",
  CHECKOUT_BUT_EMPTY: "บันทึกเป็นเช็คเอาท์ แต่คืนนั้นห้องว่าง",
  STAY_BUT_CHECKOUT: "บันทึกเป็นพักต่อ แต่ลูกค้าเช็คเอาท์",
  STAY_BUT_EMPTY: "บันทึกเป็นพักต่อ แต่คืนนั้นห้องว่าง",
  DUPLICATE_CHECKOUT: "บันทึกเช็คเอาท์ซ้ำหลายรายการ",
};

/** Pending is informational; everything else needs a look. */
export const BLOCKING_KINDS: IssueKind[] = [
  "MISSING_CHECKOUT",
  "CHECKOUT_BUT_STAYING",
  "CHECKOUT_BUT_EMPTY",
  "STAY_BUT_CHECKOUT",
  "STAY_BUT_EMPTY",
  "DUPLICATE_CHECKOUT",
];

export type NightIssue = {
  kind: IssueKind;
  night: Date;
  resourceId: string;
  roomName: string;
  bookingId?: string;
  customerName?: string;
  recordId?: string;
};

export type NightResult = {
  night: Date;
  /** Rooms occupied that night (any non-cancelled booking). */
  occupied: number;
  /** Rooms whose guest checked out on the morning after. */
  checkouts: number;
  /** Of those, rooms with a "guest checked out" cleaning logged. */
  checkoutCleaned: number;
  /** "Guest staying on" cleanings (requested by the guest). */
  stayCleans: number;
  issues: NightIssue[];
};

const DAY_MS = 86_400_000;
const key = (d: Date) => Math.round(d.getTime() / DAY_MS);

export function reconcileNights(input: { nights: Date[]; today: Date; bookings: ReconBooking[]; records: ReconRecord[] }): NightResult[] {
  const bookings = input.bookings.filter((b) => b.status !== "CANCELLED");
  const todayKey = key(input.today);

  return input.nights.map((night) => {
    const d = key(night);
    const issues: NightIssue[] = [];

    const occupiedBookings = bookings.filter((b) => key(b.checkIn) <= d && d < key(b.checkOut));
    const occupiedRooms = new Set(occupiedBookings.map((b) => b.resourceId));
    const checkingOut = occupiedBookings.filter((b) => key(b.checkOut) === d + 1);
    const checkingOutRooms = new Set(checkingOut.map((b) => b.resourceId));

    const recs = input.records.filter((r) => key(r.ledgerDate) === d);
    const checkoutRecs = recs.filter((r) => r.type === "CHECKOUT");
    const stayRecs = recs.filter((r) => r.type === "STAY");
    const cleanedRooms = new Set(checkoutRecs.map((r) => r.resourceId));

    for (const b of checkingOut) {
      const base = { night, resourceId: b.resourceId, roomName: b.roomName, bookingId: b.id, customerName: b.customerName };
      if (b.status === "RESERVED") {
        // A booking nobody checked in: the room may never have been used, so don't call its cleaning "missing".
        if (!cleanedRooms.has(b.resourceId)) issues.push({ ...base, kind: "NEVER_CHECKED_IN" });
        continue;
      }
      if (!cleanedRooms.has(b.resourceId)) {
        issues.push({ ...base, kind: key(b.checkOut) >= todayKey ? "PENDING_CHECKOUT" : "MISSING_CHECKOUT" });
      }
    }

    const seen = new Map<string, number>();
    for (const r of checkoutRecs) {
      seen.set(r.resourceId, (seen.get(r.resourceId) ?? 0) + 1);
      const base = { night, resourceId: r.resourceId, roomName: r.roomName, recordId: r.id };
      if (!checkingOutRooms.has(r.resourceId)) {
        issues.push({ ...base, kind: occupiedRooms.has(r.resourceId) ? "CHECKOUT_BUT_STAYING" : "CHECKOUT_BUT_EMPTY" });
      }
    }
    for (const [resourceId, n] of seen) {
      if (n > 1) {
        const r = checkoutRecs.find((x) => x.resourceId === resourceId)!;
        issues.push({ kind: "DUPLICATE_CHECKOUT", night, resourceId, roomName: r.roomName, recordId: r.id });
      }
    }

    for (const r of stayRecs) {
      const base = { night, resourceId: r.resourceId, roomName: r.roomName, recordId: r.id };
      if (!occupiedRooms.has(r.resourceId)) issues.push({ ...base, kind: "STAY_BUT_EMPTY" });
      else if (checkingOutRooms.has(r.resourceId)) issues.push({ ...base, kind: "STAY_BUT_CHECKOUT" });
    }

    return {
      night,
      occupied: occupiedRooms.size,
      checkouts: checkingOutRooms.size,
      checkoutCleaned: [...checkingOutRooms].filter((id) => cleanedRooms.has(id)).length,
      stayCleans: stayRecs.length,
      issues,
    };
  });
}
