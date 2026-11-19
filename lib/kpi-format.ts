import type { KpiUnit } from "@/lib/kpi-config";

export const nf = (n: number, digits = 0) => n.toLocaleString("th-TH", { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** One figure with its unit, e.g. "62.4%" or "1,234 บาท". */
export function formatKpi(value: number, unit: KpiUnit): string {
  switch (unit) {
    case "percent":
      return `${nf(value, 1)}%`;
    case "baht":
      return `${nf(value)} บาท`;
    case "perDay":
      return `${nf(value, 1)} บิล/วัน`;
    default:
      return `${nf(value)} งาน`;
  }
}

/** The figure without its unit (for a target shown beside the unit's own column). */
export function formatPlain(value: number, unit: KpiUnit): string {
  return unit === "percent" ? `${nf(value, 1)}%` : unit === "baht" ? nf(value) : nf(value, unit === "perDay" ? 1 : value % 1 ? 1 : 0);
}

export type Delta = { text: string; dir: "up" | "down" | "flat" };

/**
 * Change against the month before: percentage KPIs in points (pp), money and counts as a plain difference with the
 * relative change for money. Every KPI here is better when higher, so up is good.
 */
export function formatDelta(cur: number | null, prev: number | null, unit: KpiUnit): Delta | null {
  if (cur == null || prev == null) return null;
  const diff = cur - prev;
  if (Math.abs(diff) < 0.05) return { text: "เท่าเดือนก่อน", dir: "flat" };
  const dir = diff > 0 ? "up" : "down";
  const sign = diff > 0 ? "+" : "−";
  const abs = Math.abs(diff);
  if (unit === "percent") return { text: `${sign}${nf(abs, 1)} pp`, dir };
  if (unit === "baht") return { text: prev > 0 ? `${sign}${nf((abs / prev) * 100, 1)}%` : `${sign}${nf(abs)} บาท`, dir };
  if (unit === "perDay") return { text: `${sign}${nf(abs, 1)} บิล/วัน`, dir };
  return { text: `${sign}${nf(abs, abs % 1 ? 1 : 0)} งาน`, dir };
}

const SHORT_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
/** "2026-07" → "ก.ค." */
export const shortMonthLabel = (month: string) => SHORT_MONTHS[Number(month.slice(5, 7)) - 1];
