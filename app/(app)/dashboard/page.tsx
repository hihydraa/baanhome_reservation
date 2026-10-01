import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { parseDateOnly, todayDateOnly } from "@/lib/dates";
import { DateNav } from "@/components/dashboard/DateNav";
import { DailyGrid } from "@/components/dashboard/DailyGrid";
import { BanquetStrip } from "@/components/dashboard/BanquetStrip";
import { DailySummaryCards } from "@/components/dashboard/DailySummaryCards";
import { AutoRefresh } from "@/components/dashboard/AutoRefresh";
import { ZONE_LABELS } from "@/lib/labels";

// Multiple staff/housekeeping view this at once, so it must never serve a cached snapshot —
// always re-run the query on each request, on top of the client-side AutoRefresh polling.
export const dynamic = "force-dynamic";

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

  const [accommodationResources, accommodationBookings, banquetResources, banquetBookings, accommodationServices] =
    await Promise.all([
      prisma.resource.findMany({
        where: { type: "ACCOMMODATION" },
        orderBy: [{ zone: "asc" }, { sortOrder: "asc" }],
      }),
      prisma.accommodationBooking.findMany({
        where: {
          checkIn: { lt: nextDay },
          checkOut: { gt: date },
        },
        include: { addons: { include: { service: true } }, payment: { include: { entries: true } } },
      }),
      prisma.resource.findMany({
        where: { type: "BANQUET" },
        orderBy: [{ sortOrder: "asc" }],
      }),
      prisma.banquetBooking.findMany({
        where: { eventDate: { gte: date, lt: nextDay }, status: { not: "CANCELLED" } },
        include: { payment: { include: { entries: true } } },
        orderBy: { startTime: "asc" },
      }),
      // id + name only — housekeeping can add a service from the daily grid card without
      // ever seeing its price.
      prisma.specialService.findMany({
        where: { scope: "ACCOMMODATION" },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
    ]);

  // Prefer an active booking per room; fall back to a cancelled one so staff still see
  // "cancelled today" context, but a fresh booking over the same slot always wins.
  const activeByResource = new Map(
    accommodationBookings.filter((b) => b.status !== "CANCELLED").map((b) => [b.resourceId, b])
  );
  const cancelledByResource = new Map(
    accommodationBookings.filter((b) => b.status === "CANCELLED").map((b) => [b.resourceId, b])
  );
  const bookingByResourceId = new Map(
    accommodationResources.map((r) => [r.id, activeByResource.get(r.id) ?? cancelledByResource.get(r.id)])
  );

  const statusCounts = { RESERVED: 0, CHECKED_IN: 0, CHECKED_OUT: 0, CANCELLED: 0 };
  for (const b of accommodationBookings) {
    statusCounts[b.status]++;
  }

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
      <AutoRefresh />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold text-forest-800">ภาพรวมรายวัน</h1>
        <DateNav date={date} />
      </div>

      <DailySummaryCards
        total={accommodationResources.length}
        checkedIn={statusCounts.CHECKED_IN}
        reserved={statusCounts.RESERVED}
        checkedOut={statusCounts.CHECKED_OUT}
        cancelled={statusCounts.CANCELLED}
      />

      <BanquetStrip resources={banquetWithBookings} date={date} readOnly={readOnly} />

      <DailyGrid resourcesByZone={resourcesByZone} date={date} readOnly={readOnly} services={accommodationServices} />
    </div>
  );
}
