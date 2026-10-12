"use client";

import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const shiftDays = (dateStr: string, delta: number) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + delta));
  return t.toISOString().slice(0, 10);
};

function monthRange(today: string, monthDelta: number) {
  const [y, m] = today.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1 + monthDelta, 1));
  const last = new Date(Date.UTC(y, m + monthDelta, 0));
  return { from: first.toISOString().slice(0, 10), to: last.toISOString().slice(0, 10) };
}

/** Date-range picker with one-click presets; drives the report through ?from=&to=. */
export function RangeNav({ from, to, today }: { from: string; to: string; today: string }) {
  const router = useRouter();

  function go(nextFrom: string, nextTo: string) {
    if (!nextFrom || !nextTo || nextFrom > nextTo) return;
    router.push(`/reports?tab=overview&from=${nextFrom}&to=${nextTo}`);
  }

  const presets = [
    { label: "เดือนนี้", ...monthRange(today, 0) },
    { label: "เดือนที่แล้ว", ...monthRange(today, -1) },
    { label: "7 วันล่าสุด", from: shiftDays(today, -6), to: today },
    { label: "30 วันล่าสุด", from: shiftDays(today, -29), to: today },
  ];

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <Label>ตั้งแต่วันที่</Label>
        <Input type="date" value={from} onChange={(e) => go(e.target.value, to)} className="w-44" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>ถึงวันที่</Label>
        <Input type="date" value={to} onChange={(e) => go(from, e.target.value)} className="w-44" />
      </div>
      <div className="flex flex-wrap gap-2">
        {presets.map((p) => {
          const active = p.from === from && p.to === to;
          return (
            <button
              key={p.label}
              type="button"
              onClick={() => go(p.from, p.to)}
              className={`rounded-md border px-3 py-2 text-sm ${
                active ? "border-gold-400 bg-gold-100 font-medium text-forest-800" : "border-cream-200 text-forest-700 hover:bg-cream-100"
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
