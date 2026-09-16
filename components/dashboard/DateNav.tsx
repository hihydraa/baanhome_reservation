"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatThaiDate, isSameUtcDay, shiftDate, toDateOnlyString, todayDateOnly } from "@/lib/dates";

export function DateNav({ date }: { date: Date }) {
  const router = useRouter();
  const today = todayDateOnly();

  function goTo(d: Date) {
    router.push(`/dashboard?date=${toDateOnlyString(d)}`);
  }

  const quickTags = [
    { label: "วันนี้", date: today },
    { label: "พรุ่งนี้", date: shiftDate(today, 1) },
    { label: "วันมะรืน", date: shiftDate(today, 2) },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="icon" onClick={() => goTo(shiftDate(date, -1))} aria-label="วันก่อนหน้า">
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Input
        type="date"
        value={toDateOnlyString(date)}
        onChange={(e) => e.target.value && goTo(new Date(e.target.value + "T00:00:00Z"))}
        className="w-40"
      />
      <Button variant="outline" size="icon" onClick={() => goTo(shiftDate(date, 1))} aria-label="วันถัดไป">
        <ChevronRight className="h-4 w-4" />
      </Button>

      {quickTags.map((tag) => (
        <Button
          key={tag.label}
          variant={isSameUtcDay(date, tag.date) ? "gold" : "outline"}
          size="sm"
          onClick={() => goTo(tag.date)}
        >
          {tag.label}
        </Button>
      ))}

      <span className="ml-2 text-sm font-medium text-ink-600">{formatThaiDate(date, { withWeekday: true })}</span>
    </div>
  );
}
