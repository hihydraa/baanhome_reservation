import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatTime, parseDateOnly, shiftDate, toDateOnlyString, todayDateOnly } from "@/lib/dates";
import { AvailabilityCalendar } from "@/components/availability/AvailabilityCalendar";

// Availability changes with every booking — never serve a cached page.
export const dynamic = "force-dynamic";

/**
 * Month calendar of how full the resort is (default: % occupancy per night), and for any day which accommodation
 * and banquet rooms are booked or free. Read-only; everyone but housekeeping can open it.
 */
export default async function AvailabilityPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role === "HOUSEKEEPER") redirect("/dashboard");

  const today = todayDateOnly();
  const { month } = await searchParams;
  const monthStart = /^\d{4}-\d{2}$/.test(month ?? "") ? parseDateOnly(`${month}-01`) : new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const nextMonthStart = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1));
  const prevMonthStart = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() - 1, 1));

  const [resources, stays, events] = await Promise.all([
    prisma.resource.findMany({ orderBy: [{ zone: "asc" }, { sortOrder: "asc" }] }),
    // Stays that touch the month: they start before it ends and finish after it starts.
    prisma.accommodationBooking.findMany({
      where: { status: { not: "CANCELLED" }, checkIn: { lt: nextMonthStart }, checkOut: { gt: monthStart } },
      select: { id: true, resourceId: true, customerName: true, checkIn: true, checkOut: true, status: true, charterGroupId: true },
    }),
    prisma.banquetBooking.findMany({
      where: { status: { not: "CANCELLED" }, eventDate: { gte: monthStart, lt: nextMonthStart } },
      select: { id: true, resourceId: true, customerName: true, eventDate: true, startTime: true, endTime: true, status: true },
    }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-forest-800">ปฏิทินห้องว่าง</h1>
        <p className="text-sm text-ink-400">ดูว่าแต่ละวันห้องพักและห้องจัดเลี้ยงเต็มแค่ไหน กดที่วันที่เพื่อดูว่าห้องไหนถูกจอง ห้องไหนว่าง</p>
      </div>
      <AvailabilityCalendar
        month={toDateOnlyString(monthStart).slice(0, 7)}
        prevMonth={toDateOnlyString(prevMonthStart).slice(0, 7)}
        nextMonth={toDateOnlyString(nextMonthStart).slice(0, 7)}
        today={toDateOnlyString(today)}
        daysInMonth={shiftDate(nextMonthStart, -1).getUTCDate()}
        input={{
          resources: resources.map((r) => ({ id: r.id, name: r.name, zone: r.zone, sortOrder: r.sortOrder, roomType: r.roomType })),
          stays: stays.map((s) => ({
            id: s.id,
            resourceId: s.resourceId,
            customerName: s.customerName,
            checkIn: toDateOnlyString(s.checkIn),
            checkOut: toDateOnlyString(s.checkOut),
            status: s.status as "RESERVED" | "CHECKED_IN" | "CHECKED_OUT",
            charterGroupId: s.charterGroupId,
          })),
          events: events.map((e) => ({
            id: e.id,
            resourceId: e.resourceId,
            customerName: e.customerName,
            date: toDateOnlyString(e.eventDate),
            start: formatTime(e.startTime),
            end: formatTime(e.endTime),
            status: e.status as "RESERVED" | "CONFIRMED",
          })),
        }}
      />
    </div>
  );
}
