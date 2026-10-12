import { prisma } from "@/lib/prisma";
import { formatShortThaiDate, formatTime } from "@/lib/dates";
import { accommodationNights, quotationTotals, type BanquetDiscount } from "@/lib/payment-calc";

/** Everything the quotation shows, in a shape that can be diffed before vs. after a save. */
export type QuotationSnapshot = {
  customerName: string;
  phone: string;
  resourceName: string;
  eventDate: Date;
  startTime: Date;
  endTime: Date;
  headcount: number;
  addons: { name: string; quantity: number; price: number }[];
  /** Linked overnight rooms: quantity = nights, price = per-night room price. */
  stays: { name: string; quantity: number; price: number }[];
  discount: { type: "BAHT" | "PERCENT"; value: number; note: string };
  total: number;
};

type SnapshotInput = {
  customerName: string;
  phone: string | null;
  eventDate: Date;
  startTime: Date;
  endTime: Date;
  headcount: number;
  resource: { name: string; hourlyPrice: unknown; dailyPrice: unknown };
  addons: { name: string; quantity: number; price: number }[];
  stays: { name: string; quantity: number; price: number }[];
  discount: BanquetDiscount & { value: number; note: string };
};

export function buildQuotationSnapshot(input: SnapshotInput): QuotationSnapshot {
  const { expectedTotal } = quotationTotals(
    input,
    input.resource as { hourlyPrice: number | null; dailyPrice: number | null },
    input.addons,
    input.stays.map((st) => ({ nights: st.quantity, price: st.price })),
    input.discount
  );
  return {
    customerName: input.customerName,
    phone: input.phone ?? "",
    resourceName: input.resource.name,
    eventDate: input.eventDate,
    startTime: input.startTime,
    endTime: input.endTime,
    headcount: input.headcount,
    addons: input.addons,
    stays: input.stays,
    discount: { type: input.discount.type, value: input.discount.value, note: input.discount.note },
    total: expectedTotal,
  };
}

const baht = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const discountLabel = (d: QuotationSnapshot["discount"]) =>
  d.value > 0
    ? `${d.type === "PERCENT" ? `${d.value}%` : `${baht(d.value)} บาท`}${d.note ? ` (${d.note})` : ""}`
    : "ไม่มี";
const itemLabel = (a: { name: string; quantity: number; price: number }) => `${a.quantity} × ${baht(a.price)}`;

type Item = { name: string; quantity: number; price: number };
const nightsLabel = (a: Item) => `${a.quantity} คืน × ${baht(a.price)}`;

/** Line items are matched as a multiset on (name, qty, price); leftovers sharing a name read as an edit. */
function diffItems(
  before: Item[],
  after: Item[],
  fmt: { edit: (name: string, o: Item, x: Item) => string; add: (name: string, x: Item) => string; remove: (name: string, o: Item) => string }
): string[] {
  const key = (a: Item) => `${a.name}|${a.quantity}|${a.price}`;
  const removed = [...before];
  const added: Item[] = [];
  for (const a of after) {
    const i = removed.findIndex((r) => key(r) === key(a));
    if (i >= 0) removed.splice(i, 1);
    else added.push(a);
  }
  const out: string[] = [];
  for (const a of added) {
    const i = removed.findIndex((r) => r.name === a.name);
    if (i >= 0) {
      out.push(fmt.edit(a.name, removed[i], a));
      removed.splice(i, 1);
    } else {
      out.push(fmt.add(a.name, a));
    }
  }
  for (const r of removed) out.push(fmt.remove(r.name, r));
  return out;
}

/** Human-readable list of what changed between two quotation states; empty when nothing did. */
export function diffQuotation(before: QuotationSnapshot, after: QuotationSnapshot): string[] {
  const out: string[] = [];

  if (before.customerName !== after.customerName) out.push(`ชื่อลูกค้า: ${before.customerName} → ${after.customerName}`);
  if (before.phone !== after.phone) out.push(`เบอร์โทร: ${before.phone || "-"} → ${after.phone || "-"}`);
  if (before.resourceName !== after.resourceName) out.push(`ห้องจัดเลี้ยง: ${before.resourceName} → ${after.resourceName}`);
  if (before.eventDate.getTime() !== after.eventDate.getTime())
    out.push(`วันที่จัดงาน: ${formatShortThaiDate(before.eventDate)} → ${formatShortThaiDate(after.eventDate)}`);
  const range = (s: QuotationSnapshot) => `${formatTime(s.startTime)}-${formatTime(s.endTime)}`;
  if (range(before) !== range(after)) out.push(`เวลา: ${range(before)} → ${range(after)}`);
  if (before.headcount !== after.headcount) out.push(`จำนวนคน: ${before.headcount} → ${after.headcount}`);

  out.push(
    ...diffItems(before.addons, after.addons, {
      edit: (n, o, x) => `แก้ไขรายการ "${n}": ${itemLabel(o)} → ${itemLabel(x)}`,
      add: (n, x) => `เพิ่มรายการ "${n}" (${itemLabel(x)})`,
      remove: (n, o) => `ลบรายการ "${n}" (${itemLabel(o)})`,
    }),
    ...diffItems(before.stays, after.stays, {
      edit: (n, o, x) => `แก้ไขห้องพัก "${n}": ${nightsLabel(o)} → ${nightsLabel(x)}`,
      add: (n, x) => `เพิ่มห้องพัก "${n}" (${nightsLabel(x)})`,
      remove: (n, o) => `ลบห้องพัก "${n}" (${nightsLabel(o)})`,
    })
  );

  if (discountLabel(before.discount) !== discountLabel(after.discount))
    out.push(`ส่วนลด: ${discountLabel(before.discount)} → ${discountLabel(after.discount)}`);

  if (out.length > 0 && Math.abs(before.total - after.total) >= 0.005)
    out.push(`ยอดสุทธิ: ${baht(before.total)} → ${baht(after.total)} บาท`);

  return out;
}

/** Accommodation quotation: same idea as the banquet snapshot, but the room itself is the main line. */
export type AccommodationQuotationSnapshot = {
  customerName: string;
  phone: string;
  resourceName: string;
  checkIn: Date;
  checkOut: Date;
  guestCount: number;
  roomPrice: number;
  addons: Item[];
  discount: { type: "BAHT" | "PERCENT"; value: number; note: string };
  total: number;
};

export function diffAccommodationQuotation(
  before: AccommodationQuotationSnapshot,
  after: AccommodationQuotationSnapshot
): string[] {
  const out: string[] = [];
  if (before.customerName !== after.customerName) out.push(`ชื่อลูกค้า: ${before.customerName} → ${after.customerName}`);
  if (before.phone !== after.phone) out.push(`เบอร์โทร: ${before.phone || "-"} → ${after.phone || "-"}`);
  if (before.resourceName !== after.resourceName) out.push(`ห้องพัก: ${before.resourceName} → ${after.resourceName}`);
  if (before.checkIn.getTime() !== after.checkIn.getTime())
    out.push(`เช็คอิน: ${formatShortThaiDate(before.checkIn)} → ${formatShortThaiDate(after.checkIn)}`);
  if (before.checkOut.getTime() !== after.checkOut.getTime())
    out.push(`เช็คเอาท์: ${formatShortThaiDate(before.checkOut)} → ${formatShortThaiDate(after.checkOut)}`);
  if (before.guestCount !== after.guestCount) out.push(`จำนวนคน: ${before.guestCount} → ${after.guestCount}`);
  if (before.roomPrice !== after.roomPrice) out.push(`ราคาห้อง/คืน: ${baht(before.roomPrice)} → ${baht(after.roomPrice)}`);
  out.push(
    ...diffItems(before.addons, after.addons, {
      edit: (n, o, x) => `แก้ไขรายการ "${n}": ${itemLabel(o)} → ${itemLabel(x)}`,
      add: (n, x) => `เพิ่มรายการ "${n}" (${itemLabel(x)})`,
      remove: (n, o) => `ลบรายการ "${n}" (${itemLabel(o)})`,
    })
  );
  if (discountLabel(before.discount) !== discountLabel(after.discount))
    out.push(`ส่วนลด: ${discountLabel(before.discount)} → ${discountLabel(after.discount)}`);
  if (out.length > 0 && Math.abs(before.total - after.total) >= 0.005)
    out.push(`ยอดสุทธิ: ${baht(before.total)} → ${baht(after.total)} บาท`);
  return out;
}

/** Quotation line for a linked overnight room; cancelled bookings never bill. */
export function stayLine(b: {
  status: string;
  checkIn: Date;
  checkOut: Date;
  roomPrice: unknown;
  resource: { name: string };
}) {
  if (b.status === "CANCELLED") return null;
  return {
    name: `ห้องพัก ${b.resource.name} (${formatShortThaiDate(b.checkIn)} ถึง ${formatShortThaiDate(b.checkOut)})`,
    quantity: accommodationNights(b.checkIn, b.checkOut),
    price: b.roomPrice == null ? 0 : Number(b.roomPrice),
  };
}

export async function logQuotationChange(params: {
  /** Set for a banquet booking's quotation. */
  bookingId?: string;
  /** Set for an accommodation booking's quotation. */
  accommodationBookingId?: string;
  userId: string;
  userName: string;
  changes: string[];
}) {
  if (params.changes.length === 0) return;
  await prisma.quotationLog.create({
    data: {
      bookingId: params.bookingId,
      accommodationBookingId: params.accommodationBookingId,
      userId: params.userId,
      userName: params.userName,
      changes: params.changes,
    },
  });
}
