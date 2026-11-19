import { loadKpiSeries } from "@/lib/kpi";
import { nf, shortMonthLabel } from "@/lib/kpi-format";
import { BarTrend, Legend, LineTrend, StackedBarTrend } from "@/components/kpi/charts";

const GREEN = "#2f7d57";
const AMBER = "#e0a21b";
const RED = "#d64545";
const SALES_COLORS = { food: "#e0a21b", accommodation: "#2f9e6b", banquet: "#3b8fd6" };

function Panel({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-cream-200 bg-white p-4">
      <div>
        <h3 className="text-sm font-semibold text-forest-800">{title}</h3>
        {note && <p className="text-xs text-ink-400">{note}</p>}
      </div>
      {children}
    </div>
  );
}

export function KpiTrendsFallback() {
  return (
    <div className="grid gap-3 lg:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-60 animate-pulse rounded-xl border border-cream-200 bg-cream-100" />
      ))}
    </div>
  );
}

/** The six months up to the one being viewed: score, sales by channel against target, and occupancy. Streams in after the page. */
export async function KpiTrends({ month }: { month: string }) {
  const series = await loadKpiSeries(month, 6);
  const labels = series.map((s) => shortMonthLabel(s.month));
  const level = (s: (typeof series)[number], key: "TOTAL_SALES" | "OCC_RESORT" | "OCC_POOL_VILLA") => s.kpis[key]?.levels?.excellent ?? null;

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-forest-800">แนวโน้ม 6 เดือนล่าสุด</h2>
      <div className="grid gap-3 lg:grid-cols-3">
        <Panel title="คะแนนรวม" note="เส้นประ = เป้า 100 (ดีเยี่ยม) เดือนที่ไม่มีเป้าไม่แสดง">
          <BarTrend
            items={series.map((s, i) => ({
              label: labels[i],
              value: s.points,
              target: s.points != null ? 100 : null,
              color: s.points == null ? undefined : s.points >= 100 ? GREEN : s.points >= 50 ? AMBER : RED,
            }))}
            format={(v) => nf(v, 0)}
          />
        </Panel>
        <Panel title="ยอดขายรวมแยกช่องทาง" note="เส้นประ = เป้าดีเยี่ยมของเดือน (บาท)">
          <StackedBarTrend
            items={series.map((s, i) => ({
              label: labels[i],
              parts: [
                { value: s.sales.food ?? 0, color: SALES_COLORS.food },
                { value: s.sales.accommodation, color: SALES_COLORS.accommodation },
                { value: s.sales.banquet, color: SALES_COLORS.banquet },
              ],
              target: level(s, "TOTAL_SALES"),
            }))}
            format={(v) => (v >= 1000 ? `${nf(v / 1000, v >= 100000 ? 0 : 1)}k` : nf(v))}
          />
          <Legend
            items={[
              { color: SALES_COLORS.food, label: "สวนอาหาร" },
              { color: SALES_COLORS.accommodation, label: "ห้องพัก" },
              { color: SALES_COLORS.banquet, label: "งานจัดเลี้ยง" },
            ]}
          />
        </Panel>
        <Panel title="OCC ห้องพัก (%)" note="เส้นประ = เป้าดีเยี่ยมของเดือน">
          <LineTrend
            labels={labels}
            format={(v) => nf(v, 0)}
            series={[
              { name: "รีสอร์ท", color: "#2f7d57", values: series.map((s) => s.kpis.OCC_RESORT?.value ?? null) },
              { name: "เป้ารีสอร์ท", color: "#9bd1b3", dashed: true, values: series.map((s) => level(s, "OCC_RESORT")) },
              { name: "พูลวิลล่า", color: "#3b8fd6", values: series.map((s) => s.kpis.OCC_POOL_VILLA?.value ?? null) },
              { name: "เป้าพูลวิลล่า", color: "#a9cdee", dashed: true, values: series.map((s) => level(s, "OCC_POOL_VILLA")) },
            ]}
          />
          <Legend
            items={[
              { color: "#2f7d57", label: "รีสอร์ท" },
              { color: "#3b8fd6", label: "พูลวิลล่า" },
              { color: "#9bd1b3", label: "เป้า", dashed: true },
            ]}
          />
        </Panel>
      </div>
    </div>
  );
}
