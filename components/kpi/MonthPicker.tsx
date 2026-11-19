"use client";

import { useRouter } from "next/navigation";

/** Jump to any month with a drop-down (the scorecard has targets for Jul–Dec 2026; other months show figures only). */
export function MonthPicker({ month, options }: { month: string; options: { value: string; label: string }[] }) {
  const router = useRouter();
  return (
    <select
      aria-label="เลือกเดือน"
      value={month}
      onChange={(e) => router.push(`/kpi?month=${e.target.value}`)}
      className="h-9 rounded-md border border-cream-200 bg-white px-2 text-sm text-forest-800"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
