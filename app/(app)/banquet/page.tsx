import { prisma } from "@/lib/prisma";
import { monthGrid, parseDateOnly, todayDateOnly, toDateOnlyString } from "@/lib/dates";
import { BanquetToolbar } from "@/components/banquet/BanquetToolbar";
import { HourlyTimeline } from "@/components/banquet/HourlyTimeline";
import { MonthCalendar } from "@/components/banquet/MonthCalendar";

export default async function BanquetPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string }>;
}) {
  const { view: viewParam, date: dateParam } = await searchParams;
  const view = viewParam === "calendar" ? "calendar" : "hourly";
  const date = dateParam ? parseDateOnly(dateParam) : todayDateOnly();

  const resources = await prisma.resource.findMany({
    where: { type: "BANQUET" },
    orderBy: [{ sortOrder: "asc" }],
  });

  if (view === "hourly") {
    const nextDay = new Date(date);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);

    const bookings = await prisma.banquetBooking.findMany({
      where: { eventDate: { gte: date, lt: nextDay }, status: { not: "CANCELLED" } },
      include: { payment: true },
    });

    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-xl font-semibold text-forest-800">จองห้องจัดเลี้ยง</h1>
        <BanquetToolbar view={view} date={date} monthDate={date} />
        <HourlyTimeline resources={resources} bookings={bookings} date={date} />
      </div>
    );
  }

  const days = monthGrid(date);
  const monthBookings = await prisma.banquetBooking.findMany({
    where: {
      eventDate: { gte: days[0], lt: new Date(days[days.length - 1].getTime() + 24 * 60 * 60 * 1000) },
      status: { not: "CANCELLED" },
    },
    include: { resource: true },
  });

  const bookingsByDay = new Map<string, { id: string; customerName: string; resourceName: string }[]>();
  for (const b of monthBookings) {
    const key = toDateOnlyString(b.eventDate);
    const list = bookingsByDay.get(key) ?? [];
    list.push({ id: b.id, customerName: b.customerName, resourceName: b.resource.name });
    bookingsByDay.set(key, list);
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-forest-800">จองห้องจัดเลี้ยง</h1>
      <BanquetToolbar view={view} date={date} monthDate={date} />
      <MonthCalendar days={days} monthDate={date} bookingsByDay={bookingsByDay} today={todayDateOnly()} />
    </div>
  );
}
