import Link from "next/link";
import { formatTime, toDateOnlyString } from "@/lib/dates";
import { BANQUET_EVENT_TYPE_LABELS } from "@/lib/labels";
import type { Prisma, Resource } from "@prisma/client";

type Booking = Prisma.BanquetBookingGetPayload<{ include: { payment: true } }>;

const START_HOUR = 7;
const END_HOUR = 22;
const ROW_HEIGHT_PX = 48;
const TOTAL_HOURS = END_HOUR - START_HOUR;

const EVENT_COLOR: Record<string, string> = {
  MEETING: "bg-forest-700",
  BANQUET: "bg-gold-500",
  SEMINAR: "bg-forest-500",
  OTHER: "bg-ink-400",
};

function offsetPx(d: Date) {
  const hours = d.getUTCHours() + d.getUTCMinutes() / 60;
  return Math.max(0, (hours - START_HOUR) * ROW_HEIGHT_PX);
}

export function HourlyTimeline({
  resources,
  bookings,
  date,
}: {
  resources: Resource[];
  bookings: Booking[];
  date: Date;
}) {
  const dateStr = toDateOnlyString(date);
  const hours = Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => START_HOUR + i);

  return (
    <div className="overflow-x-auto rounded-lg border border-cream-200 bg-white">
      <div className="grid min-w-[640px]" style={{ gridTemplateColumns: `64px repeat(${resources.length}, 1fr)` }}>
        <div className="sticky left-0 z-10 border-b border-cream-200 bg-cream-100" />
        {resources.map((r) => (
          <div
            key={r.id}
            className="border-b border-l border-cream-200 bg-cream-100 px-3 py-2 text-sm font-semibold text-forest-800"
          >
            {r.name}
            {r.capacity && <span className="ml-1 text-xs font-normal text-ink-400">(สูงสุด {r.capacity})</span>}
          </div>
        ))}

        <div className="relative border-r border-cream-200" style={{ height: TOTAL_HOURS * ROW_HEIGHT_PX }}>
          {hours.map((h, i) => (
            <div
              key={h}
              className="absolute right-1 -translate-y-1/2 text-xs text-ink-400"
              style={{ top: i * ROW_HEIGHT_PX }}
            >
              {String(h).padStart(2, "0")}:00
            </div>
          ))}
        </div>

        {resources.map((r) => {
          const roomBookings = bookings.filter((b) => b.resourceId === r.id);
          return (
            <div
              key={r.id}
              className="relative border-l border-cream-200"
              style={{ height: TOTAL_HOURS * ROW_HEIGHT_PX }}
            >
              {hours.slice(0, -1).map((h, i) => (
                <div
                  key={h}
                  className="absolute left-0 right-0 border-b border-dashed border-cream-200"
                  style={{ top: (i + 1) * ROW_HEIGHT_PX }}
                />
              ))}
              <Link
                href={`/banquet/new?resourceId=${r.id}&date=${dateStr}`}
                className="absolute inset-0 z-0"
                aria-label={`จองห้อง ${r.name}`}
              />
              {roomBookings.map((b) => {
                const top = offsetPx(b.startTime);
                const height = Math.max(24, offsetPx(b.endTime) - top);
                return (
                  <Link
                    key={b.id}
                    href={`/banquet/${b.id}`}
                    className={`absolute left-1 right-1 z-10 overflow-hidden rounded-md px-2 py-1 text-xs text-white shadow ${EVENT_COLOR[b.eventType]}`}
                    style={{ top, height }}
                  >
                    <p className="font-semibold">
                      {formatTime(b.startTime)}-{formatTime(b.endTime)}
                    </p>
                    <p className="truncate opacity-90">{b.customerName}</p>
                    <p className="truncate opacity-75">{BANQUET_EVENT_TYPE_LABELS[b.eventType]}</p>
                  </Link>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
