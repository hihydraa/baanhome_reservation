import Link from "next/link";
import { cn } from "@/lib/utils";
import { GRADE_LABELS, GROUP_LABELS, KPI_DEFS, type KpiGroup } from "@/lib/kpi-config";
import { loadKpiSeries } from "@/lib/kpi";
import { formatKpi, nf, shortMonthLabel } from "@/lib/kpi-format";
import { GRADE_STYLE } from "@/components/kpi/grade-style";

const GROUP_ORDER: KpiGroup[] = ["SALES", "LODGING", "RESTAURANT", "BOOKINGS", "QUALITY"];

/** Jul–Dec 2569 in one table: every KPI by month, each cell coloured by the level reached, with the score per month. */
export async function KpiHalfYear() {
  const series = await loadKpiSeries("2026-12", 6);
  const scored = series.filter((s) => s.points != null);
  const avg = scored.length ? scored.reduce((s, m) => s + (m.points ?? 0), 0) / scored.length : null;

  return (
    <div className="rounded-xl border border-cream-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cream-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-forest-800">
          ครึ่งปีหลัง 2569 (ก.ค.–ธ.ค.) <span className="font-normal text-ink-400">สีตามระดับที่ทำได้ของแต่ละเดือน</span>
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
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="bg-forest-900 text-left text-xs text-cream-50">
              <th className="px-4 py-2 font-medium">KPI</th>
              {series.map((s) => (
                <th key={s.month} className="px-3 py-2 text-right font-medium">
                  {shortMonthLabel(s.month)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {GROUP_ORDER.map((g) => {
              const defs = KPI_DEFS.filter((d) => d.group === g);
              return [
                <tr key={`g-${g}`} className="bg-cream-100">
                  <td colSpan={7} className="px-4 py-1.5 text-xs font-semibold text-forest-800">
                    {GROUP_LABELS[g]}
                  </td>
                </tr>,
                ...defs.map((d) => (
                  <tr key={d.key} className="border-t border-cream-100">
                    <td className="px-4 py-2.5">
                      <Link href={`/kpi/${d.key}`} className="font-medium text-forest-700 hover:underline">
                        {d.label}
                      </Link>
                    </td>
                    {series.map((s) => {
                      const cell = s.kpis[d.key];
                      const style = cell?.grade ? GRADE_STYLE[cell.grade] : null;
                      return (
                        <td key={s.month} className={cn("px-3 py-2.5 text-right text-xs", style?.row)}>
                          {s.future ? <span className="text-ink-300">·</span> : cell?.value == null ? <span className="text-ink-400">—</span> : <span className="font-medium text-ink-900">{formatKpi(cell.value, d.unit).replace(" บิล/วัน", "").replace(" บาท", "").replace(" งาน", "")}</span>}
                        </td>
                      );
                    })}
                  </tr>
                )),
              ];
            })}
            <tr className="border-t-2 border-cream-200 bg-cream-50">
              <td className="px-4 py-2.5 text-sm font-semibold text-forest-800">คะแนนรวม</td>
              {series.map((s) => (
                <td key={s.month} className="px-3 py-2.5 text-right text-sm font-semibold text-forest-800">
                  {s.points == null ? <span className="font-normal text-ink-400">{s.future ? "·" : "—"}</span> : nf(s.points, 1)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="border-t border-cream-100 px-4 py-2 text-xs text-ink-500">
        {avg != null ? `คะแนนเฉลี่ยของเดือนที่มีข้อมูล ${nf(avg, 1)} / 100 · ` : ""}หน่วย: ยอดขายและบาท/บิลเป็นบาท, บิล/วันเป็นบิล, OCC/GP/คะแนนประเมินเป็น %, งานจองเป็นจำนวนงาน กดชื่อ KPI เพื่อดูรายละเอียด
      </p>
    </div>
  );
}
