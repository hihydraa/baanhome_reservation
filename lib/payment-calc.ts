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

export type BanquetTotalBreakdown = {
  hours: number;
  expectedTotal: number;
};

/** No reliable formula distinguishes "hourly" from "full-day charter" bookings, so anything
 *  8 hours or longer is priced off the daily rate (falling back to the hourly rate either way
 *  if the other rate was never set). This is a reference figure only — staff can still record
 *  whatever amount was actually agreed. */
export function banquetExpectedTotal(
  booking: { startTime: Date; endTime: Date },
  resource: { hourlyPrice: Money; dailyPrice: Money }
): BanquetTotalBreakdown {
  const hours = Math.max(0, (booking.endTime.getTime() - booking.startTime.getTime()) / 3_600_000);
  const daily = resource.dailyPrice != null ? Number(resource.dailyPrice) : null;
  const hourly = resource.hourlyPrice != null ? Number(resource.hourlyPrice) : null;

  let expectedTotal = 0;
  if (hours >= 8 && daily != null) expectedTotal = daily;
  else if (hourly != null) expectedTotal = hourly * hours;
  else if (daily != null) expectedTotal = daily;

  return { hours, expectedTotal };
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
