/**
 * The business operates in a single timezone (Asia/Bangkok, UTC+7).
 * To avoid server/client timezone drift on Vercel (which runs in UTC),
 * every date/time value is stored and read as a "naive" wall-clock value:
 * the numbers you see (year/month/day/hour/minute) ARE the Bangkok time,
 * always read/written using the UTC getters/setters so no implicit
 * timezone conversion ever happens.
 */

export function parseDateOnly(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function toDateOnlyString(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
    d.getUTCDate()
  ).padStart(2, "0")}`;
}

export function combineDateAndTime(dateStr: string, timeStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [h, min] = timeStr.split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, d, h, min, 0));
}

export function formatTime(d: Date): string {
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(
    2,
    "0"
  )}`;
}

export const THAI_MONTHS = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];

const THAI_WEEKDAYS = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];

export function formatThaiMonthYear(d: Date, opts?: { buddhist?: boolean }) {
  const month = THAI_MONTHS[d.getUTCMonth()];
  const year = opts?.buddhist === false ? d.getUTCFullYear() : d.getUTCFullYear() + 543;
  return `${month} ${year}`;
}

export function formatThaiDate(d: Date, opts?: { withWeekday?: boolean; buddhist?: boolean }) {
  const day = d.getUTCDate();
  const month = THAI_MONTHS[d.getUTCMonth()];
  const year = opts?.buddhist === false ? d.getUTCFullYear() : d.getUTCFullYear() + 543;
  const base = `${day} ${month} ${year}`;
  if (opts?.withWeekday) {
    return `${THAI_WEEKDAYS[d.getUTCDay()]} ${base}`;
  }
  return base;
}

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

/** "Today" in Asia/Bangkok, regardless of the server process's own timezone. */
export function todayDateOnly(): Date {
  const bangkokNow = new Date(Date.now() + BANGKOK_OFFSET_MS);
  return new Date(
    Date.UTC(bangkokNow.getUTCFullYear(), bangkokNow.getUTCMonth(), bangkokNow.getUTCDate())
  );
}

/** The current moment, stored as a naive UTC value equal to the Bangkok wall clock. */
export function nowBangkok(): Date {
  return new Date(Date.now() + BANGKOK_OFFSET_MS);
}

/** Converts a real timestamp (e.g. Prisma's `@updatedAt`) into the app's naive-UTC-as-Bangkok
 *  convention, so it can be read with the UTC getters/formatters like every other date here. */
export function toBangkokWallClock(d: Date): Date {
  return new Date(d.getTime() + BANGKOK_OFFSET_MS);
}

/** Combines a date-only string with the current Bangkok time-of-day — used when staff pick
 *  the date a payment was received but the time is just "now". */
export function combineDateWithNowTime(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const bangkokNow = new Date(Date.now() + BANGKOK_OFFSET_MS);
  return new Date(
    Date.UTC(y, m - 1, d, bangkokNow.getUTCHours(), bangkokNow.getUTCMinutes(), bangkokNow.getUTCSeconds())
  );
}

/** Replaces just the date part of `original`, keeping its original time-of-day — used when
 *  editing a payment entry's date without disturbing when it was actually recorded. */
export function withDatePart(original: Date, dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(
    Date.UTC(y, m - 1, d, original.getUTCHours(), original.getUTCMinutes(), original.getUTCSeconds())
  );
}

export function shiftDate(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

/** 6-week (42-day) UTC-safe grid covering the given month, Sunday-first. */
export function monthGrid(monthDate: Date): Date[] {
  const firstOfMonth = new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth(), 1));
  const start = shiftDate(firstOfMonth, -firstOfMonth.getUTCDay());
  return Array.from({ length: 42 }, (_, i) => shiftDate(start, i));
}

export function isSameUtcDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

export function isSameUtcMonth(a: Date, b: Date): boolean {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth();
}
