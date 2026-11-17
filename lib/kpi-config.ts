/**
 * BaanHome (BH) KPI scorecard, from the "KPI H2-2569" workbook (sheet "Target BH"): nine KPIs with a weight, and four
 * levels per KPI — min (scores 0%), pass (50%), excellent (100%) and exceed (120%). Targets are listed for Jul–Dec 2026
 * (2569); a month outside that has no targets, so it shows the figures without a score.
 */

export type KpiKey =
  | "BOOKINGS"
  | "BILLS_PER_DAY"
  | "BAHT_PER_BILL"
  | "OCC_RESORT"
  | "OCC_POOL_VILLA"
  | "GP_RESTAURANT"
  | "GP_BANQUET"
  | "EVALUATION"
  | "TOTAL_SALES";

export type KpiUnit = "count" | "perDay" | "baht" | "percent";

export type KpiDef = {
  key: KpiKey;
  label: string;
  weight: number;
  unit: KpiUnit;
  /** One line on how the figure is worked out — shown on the card. */
  measure: string;
};

/** In the order of the scorecard. Weights add up to 100. */
export const KPI_DEFS: KpiDef[] = [
  { key: "BOOKINGS", label: "จำนวนงานจอง/เดือน", weight: 8, unit: "count", measure: "การจองที่ยอดเกิน 10,000 บาทต่อครั้ง (งานจัดเลี้ยง + ห้องพัก เหมากลุ่มนับเป็น 1 ครั้ง) สะสมทั้งเดือน" },
  { key: "BILLS_PER_DAY", label: "จำนวนบิล/วัน", weight: 8, unit: "perDay", measure: "จำนวนบิลสวนอาหาร (ไม่นับบิลที่มีแต่ที่พัก) ÷ จำนวนวันของเดือนที่ผ่านมา" },
  { key: "BAHT_PER_BILL", label: "บาท/บิล", weight: 8, unit: "baht", measure: "ยอดขายอาหารสุทธิ ÷ จำนวนบิลสวนอาหาร" },
  { key: "OCC_RESORT", label: "OCC. Rate - รีสอร์ท", weight: 10, unit: "percent", measure: "คืนที่มีแขกพัก ÷ (จำนวนห้อง × จำนวนวันทั้งเดือน) รวมการจองล่วงหน้า" },
  { key: "OCC_POOL_VILLA", label: "OCC. Rate - พูลวิลล่า", weight: 6, unit: "percent", measure: "คืนที่มีแขกพัก ÷ (จำนวนห้อง × จำนวนวันทั้งเดือน) รวมการจองล่วงหน้า" },
  { key: "GP_RESTAURANT", label: "GP - สวนอาหาร", weight: 14, unit: "percent", measure: "% กำไรขั้นต้น/ยอดขาย กรอกรายเดือน" },
  { key: "GP_BANQUET", label: "GP - งานจอง", weight: 8, unit: "percent", measure: "(รายได้งานจัดเลี้ยงของเดือน − ต้นทุนที่กรอก) ÷ รายได้งานจัดเลี้ยง" },
  { key: "EVALUATION", label: "%คะแนนการประเมิน", weight: 18, unit: "percent", measure: "% คะแนนที่ได้จากการตรวจ/คะแนนเต็ม กรอกรายเดือน" },
  { key: "TOTAL_SALES", label: "ยอดขายรวม", weight: 20, unit: "baht", measure: "ยอดขายอาหาร (POS) + รายได้ห้องพัก + รายได้งานจัดเลี้ยง ที่ให้บริการแล้วในเดือน" },
];

export type Levels = { min: number; pass: number; excellent: number; exceed: number };

const same = (l: Levels): Levels[] => Array.from({ length: 6 }, () => l);
const monthly = (min: number[], pass: number[], excellent: number[], exceed: number[]): Levels[] =>
  min.map((m, i) => ({ min: m, pass: pass[i], excellent: excellent[i], exceed: exceed[i] }));

/** Index 0 = July … 5 = December 2026. */
const TARGETS: Record<KpiKey, Levels[]> = {
  BOOKINGS: monthly([3.3, 3.5, 3.3, 3.5, 4.5, 4.5], [6.5, 7, 6.5, 7, 9, 9], [13, 14, 13, 14, 18, 18], [16.3, 17.5, 16.3, 17.5, 22.5, 22.5]),
  BILLS_PER_DAY: monthly([8, 10, 8.8, 10, 10, 12], [16, 20, 17.6, 20, 20, 24], [20, 25, 22, 25, 25, 30], [24, 30, 26.4, 30, 30, 36]),
  BAHT_PER_BILL: same({ min: 375, pass: 750, excellent: 1000, exceed: 1250 }),
  OCC_RESORT: monthly(
    [46.34, 48.78, 43.9, 48.78, 53.66, 58.54],
    [55.61, 58.53, 52.68, 58.53, 64.39, 70.24],
    [64.88, 68.29, 61.46, 68.29, 75.12, 81.95],
    [74.15, 78.05, 70.24, 78.05, 85.85, 93.66]
  ),
  OCC_POOL_VILLA: monthly(
    [18.54, 19.51, 17.56, 19.51, 21.46, 23.42],
    [27.8, 29.27, 26.34, 29.27, 32.2, 35.12],
    [46.34, 48.78, 43.9, 48.78, 53.66, 58.54],
    [55.61, 58.54, 52.68, 58.54, 64.39, 70.25]
  ),
  GP_RESTAURANT: same({ min: 40, pass: 50, excellent: 65, exceed: 70 }),
  GP_BANQUET: same({ min: 27.5, pass: 35, excellent: 45, exceed: 55 }),
  EVALUATION: same({ min: 20, pass: 50, excellent: 80, exceed: 100 }),
  TOTAL_SALES: monthly(
    [622020, 655380, 593940, 660540, 737400, 798840],
    [829360, 873840, 791920, 880720, 983200, 1065120],
    [1036700, 1092300, 989900, 1100900, 1229000, 1331400],
    [1244040, 1310760, 1187880, 1321080, 1474800, 1597680]
  ),
};

/** The four levels for a month ("2026-11"), or null when the scorecard has no target for it. */
export function targetsFor(key: KpiKey, month: string): Levels | null {
  const [y, m] = month.split("-").map(Number);
  if (y !== 2026 || m < 7 || m > 12) return null;
  return TARGETS[key][m - 7];
}

export type Grade = "EXCEED" | "EXCELLENT" | "PASS" | "BELOW";

export const GRADE_LABELS: Record<Grade, string> = {
  EXCEED: "เกินเป้าหมาย",
  EXCELLENT: "ดีเยี่ยม",
  PASS: "ผ่าน",
  BELOW: "ต่ำกว่าเกณฑ์ผ่าน",
};

export function gradeOf(value: number, l: Levels): Grade {
  if (value >= l.exceed) return "EXCEED";
  if (value >= l.excellent) return "EXCELLENT";
  if (value >= l.pass) return "PASS";
  return "BELOW";
}

/**
 * Score as a percent of the KPI's weight: 0 at the minimum, 50 at "pass", 100 at "excellent", 120 at "exceed" and
 * capped there, worked out in a straight line between the levels.
 */
export function scorePercent(value: number, l: Levels): number {
  const pts: [number, number][] = [
    [l.min, 0],
    [l.pass, 50],
    [l.excellent, 100],
    [l.exceed, 120],
  ];
  if (value <= pts[0][0]) return 0;
  if (value >= pts[3][0]) return 120;
  for (let i = 0; i < 3; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    if (value <= x1) return x1 === x0 ? y1 : y0 + ((value - x0) / (x1 - x0)) * (y1 - y0);
  }
  return 120;
}
