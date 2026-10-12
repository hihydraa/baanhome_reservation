import type { Prisma } from "@prisma/client";

type Money = Prisma.Decimal | number | string | null | undefined;

function toNumber(v: Money): number {
  return v == null ? 0 : Number(v);
}

export function sumPaid(entries: { amount: Money }[]): number {
  return entries.reduce((sum, e) => sum + toNumber(e.amount), 0);
}

export function accommodationNights(checkIn: Date, checkOut: Date): number {
  return Math.max(0, Math.round((checkOut.getTime() - checkIn.getTime()) / 86_400_000));
}

export type AccommodationTotalBreakdown = {
  nights: number;
  roomTotal: number;
  addonsTotal: number;
  expectedTotal: number;
};

export function accommodationExpectedTotal(
  booking: { checkIn: Date; checkOut: Date; roomPrice: Money },
  addons: { price: Money; quantity: number }[]
): AccommodationTotalBreakdown {
  const nights = accommodationNights(booking.checkIn, booking.checkOut);
  const roomTotal = toNumber(booking.roomPrice) * nights;
  const addonsTotal = addons.reduce((sum, a) => sum + toNumber(a.price) * a.quantity, 0);
  return { nights, roomTotal, addonsTotal, expectedTotal: roomTotal + addonsTotal };
}

export type BanquetDiscount = { type: "BAHT" | "PERCENT"; value: Money };

export type BanquetTotalBreakdown = {
  hours: number;
  roomTotal: number;
  addonsTotal: number;
  /** Room + add-ons, VAT-inclusive, before discount. */
  subtotal: number;
  discountAmount: number;
  /** Net payable (VAT-inclusive) after discount. */
  expectedTotal: number;
};

export const VAT_RATE = 0.07;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** All banquet prices are VAT-inclusive; the VAT portion is extracted from the net, never added on top. */
export function extractVat(netInclusive: number): { exVat: number; vat: number } {
  const exVat = round2(netInclusive / (1 + VAT_RATE));
  return { exVat, vat: round2(netInclusive - exVat) };
}

export function discountAmountFor(subtotal: number, discount?: BanquetDiscount | null): number {
  const v = toNumber(discount?.value);
  if (!discount || v <= 0) return 0;
  const raw = discount.type === "PERCENT" ? (subtotal * Math.min(v, 100)) / 100 : v;
  return round2(Math.min(raw, subtotal));
}

/** No reliable formula distinguishes "hourly" from "full-day charter" bookings, so anything
 *  8 hours or longer is priced off the daily rate (falling back to the hourly rate either way
 *  if the other rate was never set). This is a reference figure only — staff can still record
 *  whatever amount was actually agreed. */
export function banquetExpectedTotal(
  booking: { startTime: Date; endTime: Date },
  resource: { hourlyPrice: Money; dailyPrice: Money },
  addons: { price: Money; quantity: number }[] = [],
  discount?: BanquetDiscount | null
): BanquetTotalBreakdown {
  const hours = Math.max(0, (booking.endTime.getTime() - booking.startTime.getTime()) / 3_600_000);
  const daily = resource.dailyPrice != null ? Number(resource.dailyPrice) : null;
  const hourly = resource.hourlyPrice != null ? Number(resource.hourlyPrice) : null;

  let roomTotal = 0;
  if (hours >= 8 && daily != null) roomTotal = daily;
  else if (hourly != null) roomTotal = hourly * hours;
  else if (daily != null) roomTotal = daily;

  const addonsTotal = addons.reduce((sum, a) => sum + toNumber(a.price) * a.quantity, 0);

  const subtotal = roomTotal + addonsTotal;
  const discountAmount = discountAmountFor(subtotal, discount);
  return { hours, roomTotal, addonsTotal, subtotal, discountAmount, expectedTotal: subtotal - discountAmount };
}

export type PaymentBadgeInfo = {
  label: string;
  variant: "success" | "warning" | "muted";
  remaining: number;
};

export function paymentBadgeInfo(paid: number, expectedTotal: number): PaymentBadgeInfo {
  if (expectedTotal <= 0) {
    if (paid > 0) {
      return { label: `ชำระแล้ว ${paid.toLocaleString("th-TH")} บาท`, variant: "success", remaining: 0 };
    }
    return { label: "ยังไม่ระบุยอด", variant: "muted", remaining: 0 };
  }

  const remaining = Math.max(0, expectedTotal - paid);
  if (paid <= 0) return { label: "รอชำระทั้งหมด", variant: "muted", remaining };
  if (remaining <= 0) return { label: "ชำระครบแล้ว", variant: "success", remaining: 0 };
  return { label: `ค้างชำระ ${remaining.toLocaleString("th-TH")} บาท`, variant: "warning", remaining };
}
