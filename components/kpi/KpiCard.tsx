import { cn } from "@/lib/utils";
import { GRADE_LABELS, type Grade, type KpiUnit } from "@/lib/kpi-config";
import type { KpiResult } from "@/lib/kpi";

const nf = (n: number, digits = 0) => n.toLocaleString("th-TH", { minimumFractionDigits: digits, maximumFractionDigits: digits });

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

const plain = (value: number, unit: KpiUnit) => (unit === "percent" ? `${nf(value, 1)}%` : unit === "baht" ? nf(value) : unit === "perDay" ? nf(value, 1) : nf(value, 1));

export const GRADE_STYLE: Record<Grade, { bar: string; badge: string }> = {
  EXCEED: { bar: "bg-emerald-600", badge: "bg-emerald-100 text-emerald-800" },
  EXCELLENT: { bar: "bg-lime-500", badge: "bg-lime-100 text-lime-800" },
  PASS: { bar: "bg-amber-400", badge: "bg-amber-100 text-amber-800" },
  BELOW: { bar: "bg-red-500", badge: "bg-red-100 text-red-800" },
};

/** One KPI: the figure, a bar with the four target levels marked, and the points it earns. */
export function KpiCard({ kpi }: { kpi: KpiResult }) {
  const { def, value, levels, grade } = kpi;
  const style = grade ? GRADE_STYLE[grade] : null;
  const top = levels?.exceed ?? 0;
  const at = (v: number) => (top > 0 ? Math.min(100, (v / top) * 100) : 0);

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-cream-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-forest-800">{def.label}</h3>
        <span className="shrink-0 rounded-full bg-cream-200 px-2 py-0.5 text-xs text-ink-600">น้ำหนัก {def.weight}%</span>
      </div>

      {value != null ? (
        <p className="text-2xl font-semibold text-ink-900">{formatKpi(value, def.unit)}</p>
      ) : (
        <p className="text-2xl font-semibold text-ink-400">—</p>
      )}

      {value == null && (
        <p className="text-xs text-amber-700">
          {kpi.missing === "INPUT" ? "ยังไม่ได้กรอกของเดือนนี้ (ผู้ดูแลระบบกรอกได้ด้านล่าง)" : kpi.missing === "POS" ? "ยังอ่านข้อมูลยอดขายร้านอาหารไม่ได้" : "ยังไม่มีข้อมูลในเดือนนี้"}
        </p>
      )}

      {levels && (
        <>
          <div className="relative mt-1 h-2.5 rounded-full bg-cream-200">
            {value != null && style && <div className={cn("h-full rounded-full", style.bar)} style={{ width: `${at(Math.max(0, value))}%` }} />}
            {[levels.pass, levels.excellent].map((l) => (
              <span key={l} className="absolute top-[-2px] h-3.5 w-px bg-ink-400" style={{ left: `${at(l)}%` }} />
            ))}
          </div>
          <div className="flex justify-between text-[11px] text-ink-500">
            <span>ผ่าน {plain(levels.pass, def.unit)}</span>
            <span>ดีเยี่ยม {plain(levels.excellent, def.unit)}</span>
            <span>เกิน {plain(levels.exceed, def.unit)}</span>
          </div>
          {kpi.scorePct != null && grade && style && (
            <div className="flex items-center justify-between gap-2">
              <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", style.badge)}>{GRADE_LABELS[grade]}</span>
              <span className="text-sm text-ink-700">
                ได้ <strong>{nf(kpi.points ?? 0, 1)}</strong> / {def.weight} คะแนน <span className="text-xs text-ink-400">({nf(kpi.scorePct)}%)</span>
              </span>
            </div>
          )}
        </>
      )}

      {kpi.hint && <p className="text-xs text-ink-500">{kpi.hint}</p>}
      <p className="mt-auto text-[11px] leading-snug text-ink-400">{def.measure}</p>
    </div>
  );
}
