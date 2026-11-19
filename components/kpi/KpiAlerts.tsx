import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { KpiAlert } from "@/lib/kpi-alerts";

/** "รายการเตือน": the few things to look at first, generated from the figures. */
export function KpiAlerts({ alerts }: { alerts: KpiAlert[] }) {
  if (alerts.length === 0) {
    return <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">ไม่มีรายการเตือน — KPI ที่มีข้อมูลทุกตัวผ่านเกณฑ์ขึ้นไป</p>;
  }
  return (
    <div className="rounded-xl border border-cream-200 bg-white p-4">
      <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-forest-800">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        รายการเตือน <span className="text-xs font-normal text-ink-400">{alerts.length} รายการ</span>
      </p>
      <ul className="flex flex-col gap-1.5">
        {alerts.map((a, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-ink-800">
            <span className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", a.level === "RED" ? "bg-red-500" : "bg-amber-400")} />
            {a.text}
          </li>
        ))}
      </ul>
    </div>
  );
}
