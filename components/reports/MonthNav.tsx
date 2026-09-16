"use client";

import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function shiftMonth(monthStr: string, delta: number): string {
  const [y, m] = monthStr.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function MonthNav({ month }: { month: string }) {
  const router = useRouter();

  function goTo(next: string) {
    router.push(`/reports?tab=overview&month=${next}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1.5">
        <Label>เดือน</Label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => goTo(shiftMonth(month, -1))}
            className="rounded-md border border-cream-200 px-2.5 py-2 text-sm text-forest-700 hover:bg-cream-100"
            aria-label="เดือนก่อนหน้า"
          >
            ‹
          </button>
          <Input
            type="month"
            value={month}
            onChange={(e) => e.target.value && goTo(e.target.value)}
            className="w-40"
          />
          <button
            type="button"
            onClick={() => goTo(shiftMonth(month, 1))}
            className="rounded-md border border-cream-200 px-2.5 py-2 text-sm text-forest-700 hover:bg-cream-100"
            aria-label="เดือนถัดไป"
          >
            ›
          </button>
        </div>
      </div>
    </div>
  );
}
