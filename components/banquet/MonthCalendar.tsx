import Link from "next/link";
import { cn } from "@/lib/utils";
import { isSameUtcDay, isSameUtcMonth, toDateOnlyString } from "@/lib/dates";

type Booking = { id: string; customerName: string; resourceName: string };

const WEEKDAY_LABELS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

export function MonthCalendar({
  days,
  monthDate,
  bookingsByDay,
  today,
}: {
  days: Date[];
  monthDate: Date;
  bookingsByDay: Map<string, Booking[]>;
  today: Date;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-cream-200 bg-white">
      <div className="grid grid-cols-7 bg-forest-700 text-cream-50">
        {WEEKDAY_LABELS.map((w) => (
          <div key={w} className="px-2 py-2 text-center text-xs font-semibold">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const dateStr = toDateOnlyString(day);
          const inMonth = isSameUtcMonth(day, monthDate);
          const bookings = bookingsByDay.get(dateStr) ?? [];
          const isToday = isSameUtcDay(day, today);

          return (
            <Link
              key={dateStr}
              href={`/banquet?view=hourly&date=${dateStr}`}
              className={cn(
                "flex min-h-[92px] flex-col gap-1 border-b border-r border-cream-200 p-2 text-xs transition-colors hover:bg-cream-100",
                !inMonth && "bg-cream-100/60 text-ink-400"
              )}
            >
              <span
                className={cn(
                  "inline-flex h-6 w-6 items-center justify-center rounded-full font-medium",
                  isToday && "bg-gold-500 text-forest-900"
                )}
              >
                {day.getUTCDate()}
              </span>
              <div className="flex flex-col gap-0.5">
                {bookings.slice(0, 3).map((b) => (
                  <span
                    key={b.id}
                    className="truncate rounded bg-gold-100 px-1 py-0.5 text-[10px] text-forest-800"
                  >
                    {b.resourceName} {b.customerName}
                  </span>
                ))}
                {bookings.length > 3 && (
                  <span className="text-[10px] text-ink-400">+{bookings.length - 3} รายการ</span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
