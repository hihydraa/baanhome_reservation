import Link from "next/link";
import { cn } from "@/lib/utils";
import { GRADE_LABELS, GROUP_LABELS, type KpiGroup } from "@/lib/kpi-config";
import { formatKpi, formatPlain, nf } from "@/lib/kpi-format";
import type { KpiMonth } from "@/lib/kpi";
import { DeltaBadge } from "@/components/kpi/DeltaBadge";
import { GRADE_STYLE } from "@/components/kpi/grade-style";

const GROUP_ORDER: KpiGroup[] = ["SALES", "LODGING", "RESTAURANT", "BOOKINGS", "QUALITY"];

/**
 * Every KPI in one table, grouped by area, each row coloured by the level reached (below pass / pass / excellent /
 * above target) so a glance shows where the red is. Hover a name for how it is measured.
 */
export function KpiMatrix({ data }: { data: KpiMonth }) {
  return (
    <div className="rounded-xl border border-cream-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cream-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-forest-800">
          KPI ทั้ง 9 ตัว <span className="font-normal text-ink-400">(ผลจริง เทียบเป้าระดับดีเยี่ยม)</span>
        </h2>
        <div className="flex flex-wrap items-center gap-3 text-xs text-ink-600">
          {(["EXCEED", "EXCELLENT", "PASS", "BELOW"] as const).map((g) => (
            <span key={g} className="inline-flex items-center gap-1.5">
              <span className={cn("h-3 w-3 rounded-full", GRADE_STYLE[g].dot)} />
              {GRADE_LABELS[g]}
            </span>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="bg-forest-900 text-left text-xs text-cream-50">
              <th className="px-4 py-2 font-medium">KPI</th>
              <th className="px-3 py-2 text-right font-medium">ผลจริง</th>
              <th className="px-3 py-2 text-right font-medium">เป้า (ดีเยี่ยม)</th>
              <th className="px-3 py-2 text-right font-medium">% ของเป้า</th>
              <th className="px-3 py-2 text-right font-medium">คะแนน</th>
              <th className="px-3 py-2 text-right font-medium">เดือนก่อน</th>
              <th className="px-3 py-2 font-medium">ระดับ</th>
            </tr>
          </thead>
          <tbody>
            {GROUP_ORDER.map((g) => {
              const rows = data.kpis.filter((k) => k.def.group === g);
              if (rows.length === 0) return null;
              return [
                <tr key={`g-${g}`} className="bg-cream-100">
                  <td colSpan={7} className="px-4 py-1.5 text-xs font-semibold text-forest-800">
                    {GROUP_LABELS[g]}
                  </td>
                </tr>,
                ...rows.map((k) => {
                  const style = k.grade ? GRADE_STYLE[k.grade] : null;
                  const pct = k.value != null && k.levels ? (k.value / k.levels.excellent) * 100 : null;
                  return (
                    <tr key={k.def.key} className={cn("border-t border-cream-100", style?.row)} title={k.def.measure}>
                      <td className="px-4 py-2.5">
                        <Link href={`/kpi/${k.def.key}?month=${data.month}`} className="font-medium text-forest-700 hover:underline">
                          {k.def.label}
                        </Link>
                        <span className="ml-2 text-xs text-ink-400">น้ำหนัก {k.def.weight}%</span>
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold text-ink-900">
                        {k.value == null ? (
                          <span className="text-xs font-normal text-amber-700">{k.missing === "INPUT" ? "ยังไม่ได้กรอก" : k.missing === "POS" ? "อ่าน POS ไม่ได้" : "—"}</span>
                        ) : (
                          formatKpi(k.value, k.def.unit)
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right text-ink-600">{k.levels ? formatPlain(k.levels.excellent, k.def.unit) : "—"}</td>
                      <td className="px-3 py-2.5 text-right text-ink-900">{pct == null ? "—" : `${nf(pct)}%`}</td>
                      <td className="px-3 py-2.5 text-right text-ink-900">{k.points == null ? "—" : `${nf(k.points, 1)} / ${k.def.weight}`}</td>
                      <td className="px-3 py-2.5 text-right">
                        <DeltaBadge cur={k.value} prev={k.prevValue} unit={k.def.unit} />
                      </td>
                      <td className="px-3 py-2.5">{k.grade && style ? <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", style.badge)}>{GRADE_LABELS[k.grade]}</span> : <span className="text-xs text-ink-400">—</span>}</td>
                    </tr>
                  );
                }),
              ];
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
