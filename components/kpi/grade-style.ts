import type { Grade } from "@/lib/kpi-config";

/** One colour language for the whole KPI page: red below pass, amber pass, lime excellent, green above target. */
export const GRADE_STYLE: Record<Grade, { bar: string; badge: string; row: string; dot: string }> = {
  EXCEED: { bar: "bg-emerald-600", badge: "bg-emerald-100 text-emerald-800", row: "bg-emerald-50", dot: "bg-emerald-600" },
  EXCELLENT: { bar: "bg-lime-500", badge: "bg-lime-100 text-lime-800", row: "bg-lime-50", dot: "bg-lime-500" },
  PASS: { bar: "bg-amber-400", badge: "bg-amber-100 text-amber-800", row: "bg-amber-50", dot: "bg-amber-400" },
  BELOW: { bar: "bg-red-500", badge: "bg-red-100 text-red-800", row: "bg-red-50", dot: "bg-red-500" },
};
