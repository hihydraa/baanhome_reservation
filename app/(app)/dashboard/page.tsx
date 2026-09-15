import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { parseDateOnly, todayDateOnly } from "@/lib/dates";
import { DateNav } from "@/components/dashboard/DateNav";
import { DailyGrid } from "@/components/dashboard/DailyGrid";
import { BanquetStrip } from "@/components/dashboard/BanquetStrip";
import { ZONE_LABELS } from "@/lib/labels";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const session = await auth();
  const readOnly = session?.user.role === "HOUSEKEEPER";
  const { date: dateParam } = await searchParams;
  const date = dateParam ? parseDateOnly(dateParam) : todayDateOnly();
  const nextDay = new Date(date);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);

  const [accommodationResources, accommodationBookings, banquetResources, banquetBookings] =
    await Promise.all([
      prisma.resource.findMany({
        where: { type: "ACCOMMODATION" },
        orderBy: [{ zone: "asc" }, { sortOrder: "asc" }],
      }),
      prisma.accommodationBooking.findMany({
        where: {
          checkIn: { lt: nextDay },
          checkOut: { gt: date },
          status: { not: "CANCELLED" },
        },
        include: { addons: true, payment: true },
      }),
      prisma.resource.findMany({
        where: { type: "BANQUET" },
        orderBy: [{ sortOrder: "asc" }],
      }),
      prisma.banquetBooking.findMany({
        where: { eventDate: { gte: date, lt: nextDay }, status: { not: "CANCELLED" } },
        include: { payment: true },
        orderBy: { startTime: "asc" },
      }),
    ]);

  const bookingByResourceId = new Map(accommodationBookings.map((b) => [b.resourceId, b]));

  const resourcesByZone: Record<string, (typeof accommodationResources[number] & { booking?: (typeof accommodationBookings)[number] })[]> = {};
  for (const zone of Object.keys(ZONE_LABELS)) {
    const inZone = accommodationResources.filter((r) => r.zone === zone);
    if (inZone.length === 0) continue;
    resourcesByZone[zone] = inZone.map((r) => ({ ...r, booking: bookingByResourceId.get(r.id) }));
  }

  const banquetWithBookings = banquetResources.map((r) => ({
    ...r,
    bookings: banquetBookings.filter((b) => b.resourceId === r.id),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold text-forest-800">ภาพรวมรายวัน</h1>
        <DateNav date={date} />
      </div>

      <BanquetStrip resources={banquetWithBookings} date={date} readOnly={readOnly} />

      <DailyGrid resourcesByZone={resourcesByZone} date={date} readOnly={readOnly} />
    </div>
  );
}
