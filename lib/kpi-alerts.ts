import { GRADE_LABELS } from "@/lib/kpi-config";
import { formatKpi, formatPlain, nf } from "@/lib/kpi-format";
import type { KpiMonth } from "@/lib/kpi";

export type KpiAlert = { level: "RED" | "AMBER"; text: string; /** Larger first: the KPI's weight, so the costly ones lead. */ weight: number };

/**
 * What the executives should look at first: KPIs under the "pass" level, sales behind the month's pace, and figures
 * that have not been entered or could not be read. Red before amber, heavier KPIs before lighter ones.
 */
export function buildAlerts(data: KpiMonth, isAdmin: boolean): KpiAlert[] {
  const alerts: KpiAlert[] = [];

  for (const k of data.kpis) {
    // While the month runs, sales so far is always short of the month's target; the pace alert below says it better.
    if (k.def.key === "TOTAL_SALES" && data.pace) continue;
    if (k.grade === "BELOW" && k.levels && k.value != null) {
      alerts.push({
        level: "RED",
        weight: k.def.weight,
        text: `${k.def.label} ${formatKpi(k.value, k.def.unit)} — ${GRADE_LABELS.BELOW} (ผ่านที่ ${formatPlain(k.levels.pass, k.def.unit)})`,
      });
    }
  }

  if (data.pace && data.pace.toDatePct < 100) {
    const p = data.pace;
    alerts.push({
      level: p.toDatePct < 80 ? "RED" : "AMBER",
      weight: 20,
      text:
        `ยอดขายรวมทำได้ ${nf(p.toDatePct)}% ของเป้า (ดีเยี่ยม) ถึงวันนี้` +
        (p.neededPerDay != null && p.remainingDays > 0 ? ` — ต้องทำวันละ ${nf(p.neededPerDay)} บาท อีก ${p.remainingDays} วัน` : ""),
    });
  }

  const missing = data.kpis.filter((k) => k.missing === "INPUT");
  if (missing.length > 0 && isAdmin && data.hasTargets) {
    alerts.push({ level: "AMBER", weight: 1, text: `ยังไม่ได้กรอกเดือนนี้: ${missing.map((k) => k.def.label).join(", ")}` });
  }
  if (data.kpis.some((k) => k.missing === "POS")) {
    alerts.push({ level: "AMBER", weight: 1, text: "อ่านยอดขายร้านอาหารจาก Google Sheet ไม่ได้ KPI ที่ใช้ข้อมูล POS จึงยังไม่แสดง" });
  }

  return alerts.sort((a, b) => Number(b.level === "RED") - Number(a.level === "RED") || b.weight - a.weight);
}
