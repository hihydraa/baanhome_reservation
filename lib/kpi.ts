import { prisma } from "@/lib/prisma";
import { loadPerformance } from "@/lib/performance";
import { loadPosMonth, type PosMonth } from "@/lib/pos-sheet";
import { accommodationExpectedTotal, banquetExpectedTotal } from "@/lib/payment-calc";
import { parseDateOnly, shiftDate, toDateOnlyString, todayDateOnly } from "@/lib/dates";
import { KPI_DEFS, gradeOf, scorePercent, targetsFor, type Grade, type KpiDef, type KpiKey, type Levels } from "@/lib/kpi-config";

/** A booking counts as a "งานจอง" when it is worth more than this (baht, VAT included). */
export const BOOKING_MIN_VALUE = 10_000;

export type KpiResult = {
  def: KpiDef;
  /** Null when the figure is not available yet (see `missing`). */
  value: number | null;
  levels: Levels | null;
  grade: Grade | null;
  /** Percent of the weight earned, 0–120. */
  scorePct: number | null;
  /** weight × scorePct / 100 */
  points: number | null;
  /** Why there is no value: waiting for typed-in input, or the POS sheet could not be read. */
  missing: "INPUT" | "POS" | null;
  /** Extra line under the value, e.g. a run-rate for the whole month. */
  hint: string | null;
};

export type KpiMonth = {
  month: string;
  /** The month is still running, so cumulative figures are month-to-date. */
  inProgress: boolean;
  daysInMonth: number;
  elapsedDays: number;
  hasTargets: boolean;
  kpis: KpiResult[];
  /** Weighted points earned (max 120 when every KPI is above "exceed"), and how much of the 100 weight has a figure. */
  points: number;
  scoredWeight: number;
  sales: { food: number | null; accommodation: number; banquet: number; upcoming: number };
  inputs: { banquetCost: number | null; restaurantGp: number | null; evaluationPct: number | null; updatedByName: string | null; updatedAt: Date | null };
  warnings: string[];
};

const daysIn = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};

/** Bookings worth more than BOOKING_MIN_VALUE in the month: banquet events by event date, stays by check-in (a charter is one). */
async function countBigBookings(from: Date, toExclusive: Date): Promise<number> {
  const [banquet, stays] = await Promise.all([
    prisma.banquetBooking.findMany({
      where: { status: { not: "CANCELLED" }, eventDate: { gte: from, lt: toExclusive } },
      include: { resource: true, addons: true },
    }),
    prisma.accommodationBooking.findMany({
      where: { status: { not: "CANCELLED" }, checkIn: { gte: from, lt: toExclusive } },
      include: { addons: true },
    }),
  ]);
  let count = 0;
  for (const b of banquet) {
    const t = banquetExpectedTotal(b, b.resource, b.addons, { type: b.discountType, value: b.discountValue }).expectedTotal;
    if (t > BOOKING_MIN_VALUE) count++;
  }
  const byUnit = new Map<string, number>();
  for (const s of stays) {
    const key = s.charterGroupId ?? s.id;
    byUnit.set(key, (byUnit.get(key) ?? 0) + accommodationExpectedTotal(s, s.addons).expectedTotal);
  }
  for (const t of byUnit.values()) if (t > BOOKING_MIN_VALUE) count++;
  return count;
}

export async function loadKpiMonth(month: string): Promise<KpiMonth> {
  const today = todayDateOnly();
  const todayStr = toDateOnlyString(today);
  const monthStart = parseDateOnly(`${month}-01`);
  const days = daysIn(month);
  const monthEnd = parseDateOnly(`${month}-${String(days).padStart(2, "0")}`);
  const nextStart = shiftDate(monthEnd, 1);
  const inProgress = todayStr >= `${month}-01` && todayStr <= `${month}-${String(days).padStart(2, "0")}`;
  const future = todayStr < `${month}-01`;

  const [perf, pos, bigBookings, input] = await Promise.all([
    loadPerformance(month + "-01", toDateOnlyString(monthEnd)),
    future ? Promise.resolve(null) : loadPosMonth(month),
    countBigBookings(monthStart, nextStart),
    prisma.kpiMonthlyInput.findUnique({ where: { month } }),
  ]);

  const warnings: string[] = [];
  let posData: PosMonth | null = null;
  if (pos) {
    if ("error" in pos) warnings.push(`อ่านยอดขายร้านอาหารจาก Google Sheet ไม่สำเร็จ: ${pos.error}`);
    else posData = pos.data;
  }

  // Days the restaurant figures cover: the whole month once it is over, otherwise up to the last day with sales.
  const elapsedDays = future ? 0 : inProgress ? Number((posData?.lastDate ?? todayStr).slice(8, 10)) : days;
  const zone = (z: string) => perf.accommodationOcc.byZone.find((r) => r.zone === z)?.rate ?? null;
  const banquetRevenue = perf.revenue.banquet;
  const num = (v: unknown) => (v == null ? null : Number(v));
  const banquetCost = num(input?.banquetCost);
  const restaurantGp = num(input?.restaurantGp);
  const evaluationPct = num(input?.evaluationPct);

  const accommodationSales = perf.revenue.recognized.accommodation;
  const banquetSales = perf.revenue.recognized.banquet;
  const foodSales = posData ? posData.foodSales : null;
  const totalSales = foodSales == null ? null : foodSales + accommodationSales + banquetSales;

  const raw: Record<KpiKey, { value: number | null; missing?: "INPUT" | "POS"; hint?: string }> = {
    BOOKINGS: { value: future ? null : bigBookings },
    BILLS_PER_DAY: posData && elapsedDays > 0 ? { value: posData.foodBills / elapsedDays } : { value: null, missing: "POS" },
    BAHT_PER_BILL: posData && posData.foodBills > 0 ? { value: posData.foodSales / posData.foodBills } : { value: null, missing: "POS" },
    OCC_RESORT: { value: zone("RESORT") },
    OCC_POOL_VILLA: { value: zone("POOL_VILLA") },
    GP_RESTAURANT: restaurantGp == null ? { value: null, missing: "INPUT" } : { value: restaurantGp },
    GP_BANQUET:
      banquetCost == null
        ? { value: null, missing: "INPUT" }
        : banquetRevenue > 0
          ? { value: ((banquetRevenue - banquetCost) / banquetRevenue) * 100 }
          : { value: null },
    EVALUATION: evaluationPct == null ? { value: null, missing: "INPUT" } : { value: evaluationPct },
    TOTAL_SALES:
      totalSales == null
        ? { value: null, missing: "POS" }
        : {
            value: totalSales,
            hint:
              inProgress && elapsedDays >= 3
                ? `ถ้าขายได้เท่านี้ต่อวัน ทั้งเดือนประมาณ ${Math.round((totalSales / elapsedDays) * days).toLocaleString("th-TH")} บาท`
                : undefined,
          },
  };

  const kpis: KpiResult[] = KPI_DEFS.map((def) => {
    const r = raw[def.key];
    const levels = targetsFor(def.key, month);
    const hasValue = r.value != null;
    const scorePct = hasValue && levels ? scorePercent(r.value as number, levels) : null;
    return {
      def,
      value: r.value,
      levels,
      grade: hasValue && levels ? gradeOf(r.value as number, levels) : null,
      scorePct,
      points: scorePct == null ? null : (def.weight * scorePct) / 100,
      missing: r.missing ?? null,
      hint: r.hint ?? null,
    };
  });

  return {
    month,
    inProgress,
    daysInMonth: days,
    elapsedDays,
    hasTargets: targetsFor("BOOKINGS", month) != null,
    kpis,
    points: kpis.reduce((s, k) => s + (k.points ?? 0), 0),
    scoredWeight: kpis.filter((k) => k.value != null).reduce((s, k) => s + k.def.weight, 0),
    sales: { food: foodSales, accommodation: accommodationSales, banquet: banquetSales, upcoming: perf.revenue.upcoming.total },
    inputs: {
      banquetCost,
      restaurantGp,
      evaluationPct,
      updatedByName: input?.updatedByName ?? null,
      updatedAt: input?.updatedAt ?? null,
    },
    warnings,
  };
}
