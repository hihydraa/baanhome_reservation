import { prisma } from "@/lib/prisma";
import { rangesOverlap } from "@/lib/conflict";

export async function findBanquetConflict(params: {
  resourceId: string;
  eventDate: Date;
  startTime: Date;
  endTime: Date;
  excludeBookingId?: string;
}) {
  const dayStart = new Date(params.eventDate);
  const dayEnd = new Date(params.eventDate);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  const sameDayBookings = await prisma.banquetBooking.findMany({
    where: {
      resourceId: params.resourceId,
      eventDate: { gte: dayStart, lt: dayEnd },
      status: { not: "CANCELLED" },
      ...(params.excludeBookingId ? { id: { not: params.excludeBookingId } } : {}),
    },
    include: { resource: true },
  });

  return (
    sameDayBookings.find((b) =>
      rangesOverlap(params.startTime, params.endTime, b.startTime, b.endTime)
    ) ?? null
  );
}

export async function findAccommodationConflict(params: {
  resourceId: string;
  checkIn: Date;
  checkOut: Date;
  excludeBookingId?: string;
}) {
  const overlapping = await prisma.accommodationBooking.findMany({
    where: {
      resourceId: params.resourceId,
      status: { not: "CANCELLED" },
      checkIn: { lt: params.checkOut },
      checkOut: { gt: params.checkIn },
      ...(params.excludeBookingId ? { id: { not: params.excludeBookingId } } : {}),
    },
    include: { resource: true },
  });

  return overlapping[0] ?? null;
}
