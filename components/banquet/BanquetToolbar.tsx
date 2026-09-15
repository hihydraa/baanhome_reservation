"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatThaiDate, shiftDate, toDateOnlyString, todayDateOnly } from "@/lib/dates";

export function BanquetToolbar({
  view,
  date,
  monthDate,
}: {
  view: "hourly" | "calendar";
  date: Date;
  monthDate: Date;
}) {
  const router = useRouter();

  function shiftMonth(delta: number) {
    const next = new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + delta, 1));
    router.push(`/banquet?view=calendar&date=${toDateOnlyString(next)}`);
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-1 rounded-lg bg-cream-200 p-1">
        <Link
          href={`/banquet?view=hourly&date=${toDateOnlyString(date)}`}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium",
            view === "hourly" ? "bg-forest-700 text-cream-50" : "text-ink-600"
          )}
        >
          รายวัน (ชั่วโมง)
        </Link>
        <Link
          href={`/banquet?view=calendar&date=${toDateOnlyString(date)}`}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium",
            view === "calendar" ? "bg-forest-700 text-cream-50" : "text-ink-600"
          )}
        >
          ปฏิทิน 31 วัน
        </Link>
      </div>

      {view === "hourly" ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.push(`/banquet?view=hourly&date=${toDateOnlyString(shiftDate(date, -1))}`)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Input
            type="date"
            value={toDateOnlyString(date)}
            onChange={(e) =>
              e.target.value && router.push(`/banquet?view=hourly&date=${e.target.value}`)
            }
            className="w-40"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.push(`/banquet?view=hourly&date=${toDateOnlyString(shiftDate(date, 1))}`)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="gold"
            size="sm"
            onClick={() => router.push(`/banquet?view=hourly&date=${toDateOnlyString(todayDateOnly())}`)}
          >
            วันนี้
          </Button>
          <span className="text-sm font-medium text-ink-600">
            {formatThaiDate(date, { withWeekday: true })}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => shiftMonth(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium text-ink-600">{formatThaiDate(monthDate).split(" ").slice(1).join(" ")}</span>
          <Button variant="outline" size="icon" onClick={() => shiftMonth(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      <Link href={`/banquet/new?date=${toDateOnlyString(date)}`}>
        <Button variant="gold">
          <Plus className="h-4 w-4" />
          จองห้องจัดเลี้ยงใหม่
        </Button>
      </Link>
    </div>
  );
}
