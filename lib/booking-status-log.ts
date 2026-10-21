import type { AccommodationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Actor = { id: string; name?: string | null; username: string };

/** Records a booking being created with, or moved to, a status. fromStatus is null for the creation row. */
export async function logBookingStatus(params: {
  bookingIds: string[];
  fromStatus: AccommodationStatus | null;
  toStatus: AccommodationStatus;
  user: Actor;
}) {
  if (params.bookingIds.length === 0) return;
  await prisma.bookingStatusLog.createMany({
    data: params.bookingIds.map((bookingId) => ({
      bookingId,
      fromStatus: params.fromStatus,
      toStatus: params.toStatus,
      userId: params.user.id,
      userName: params.user.name ?? params.user.username,
    })),
  });
}
