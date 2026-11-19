import { cn } from "@/lib/utils";
import { formatDelta } from "@/lib/kpi-format";
import type { KpiUnit } from "@/lib/kpi-config";

/** ▲/▼ against the month before. Higher is better for every BaanHome KPI, so up is green and down is red. */
export function DeltaBadge({ cur, prev, unit, className }: { cur: number | null; prev: number | null; unit: KpiUnit; className?: string }) {
  const d = formatDelta(cur, prev, unit);
  if (!d) return <span className={cn("text-xs text-ink-400", className)}>—</span>;
  return (
    <span className={cn("whitespace-nowrap text-xs font-medium", d.dir === "up" ? "text-emerald-700" : d.dir === "down" ? "text-red-700" : "text-ink-500", className)}>
      {d.dir === "up" ? "▲ " : d.dir === "down" ? "▼ " : ""}
      {d.text}
    </span>
  );
}
