import type { AccommodationStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Actor = { id: string; name?: string | null; username: string };

type Params = {
  bookingIds: string[];
  /** Null for the creation row. */
  fromStatus: AccommodationStatus | null;
  toStatus: AccommodationStatus;
  user: Actor;
};

/** The history rows for a booking being created with, or moved to, a status. */
export function statusLogRows(params: Params): Prisma.BookingStatusLogCreateManyInput[] {
  return params.bookingIds.map((bookingId) => ({
    bookingId,
    fromStatus: params.fromStatus,
    toStatus: params.toStatus,
    userId: params.user.id,
    userName: params.user.name ?? params.user.username,
  }));
}

/**
 * Records a status change. Pass the transaction client as `db` to write it in the same transaction as the booking
 * change, so a booking can never change status without its history row.
 */
export async function logBookingStatus(params: Params, db: Pick<typeof prisma, "bookingStatusLog"> = prisma) {
  if (params.bookingIds.length === 0) return;
  await db.bookingStatusLog.createMany({ data: statusLogRows(params) });
}
