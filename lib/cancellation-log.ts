import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatThaiDate, formatTime } from "@/lib/dates";

export async function logAccommodationCancellation(params: {
  bookingId: string;
  resourceName: string;
  customerName: string;
  phone: string;
  checkIn: Date;
  checkOut: Date;
  reason?: string;
  cancelledById?: string;
}) {
  await prisma.cancellationLog.create({
    data: {
      bookingType: "ACCOMMODATION",
      bookingId: params.bookingId,
      resourceName: params.resourceName,
      customerName: params.customerName,
      phone: params.phone,
      bookingPeriod: `${formatThaiDate(params.checkIn)} - ${formatThaiDate(params.checkOut)}`,
      reason: params.reason,
      cancelledById: params.cancelledById,
    },
  });
}

export async function logBanquetCancellation(params: {
  bookingId: string;
  resourceName: string;
  customerName: string;
  phone?: string | null;
  eventDate: Date;
  startTime: Date;
  endTime: Date;
  reason?: string;
  cancelledById?: string;
}) {
  await prisma.cancellationLog.create({
    data: {
      bookingType: "BANQUET",
      bookingId: params.bookingId,
      resourceName: params.resourceName,
      customerName: params.customerName,
      phone: params.phone ?? undefined,
      bookingPeriod: `${formatThaiDate(params.eventDate)} ${formatTime(params.startTime)}-${formatTime(params.endTime)}`,
      reason: params.reason,
      cancelledById: params.cancelledById,
    },
  });
}

/** JSON-safe copy (Decimal → string, Date → ISO string) for CancellationLog.snapshot. */
function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

type Deleter = { id: string };

/**
 * ADMIN-only soft delete of an accommodation booking: the row and its payments stay in the
 * database (hidden by lib/prisma.ts), links to banquet bookings are cut so they stop showing it,
 * and a DELETE row with a full snapshot goes to CancellationLog — all in one transaction.
 * Returns false when the booking doesn't exist or is already deleted.
 */
export async function softDeleteAccommodationBooking(id: string, reason: string, by: Deleter) {
  return prisma.$transaction(async (tx) => {
    const booking = await tx.accommodationBooking.findUnique({
      where: { id },
      include: {
        resource: true,
        addons: { include: { service: true } },
        payment: { include: { entries: { include: { receivedBy: { select: { id: true, name: true } } } } } },
        linkedBanquetBookings: { select: { id: true, customerName: true, eventDate: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });
    if (!booking) return false;

    await tx.accommodationBooking.update({
      where: { id },
      data: { deletedAt: new Date(), deletedById: by.id, linkedBanquetBookings: { set: [] } },
    });
    await tx.cancellationLog.create({
      data: {
        action: "DELETE",
        bookingType: "ACCOMMODATION",
        bookingId: booking.id,
        resourceName: booking.resource.name,
        customerName: booking.customerName,
        phone: booking.phone,
        bookingPeriod: `${formatThaiDate(booking.checkIn)} - ${formatThaiDate(booking.checkOut)}`,
        reason,
        cancelledById: by.id,
        snapshot: toJson(booking),
      },
    });
    return true;
  });
}

/** Banquet counterpart of softDeleteAccommodationBooking. */
export async function softDeleteBanquetBooking(id: string, reason: string, by: Deleter) {
  return prisma.$transaction(async (tx) => {
    const booking = await tx.banquetBooking.findUnique({
      where: { id },
      include: {
        resource: true,
        addons: { include: { service: true } },
        payment: { include: { entries: { include: { receivedBy: { select: { id: true, name: true } } } } } },
        linkedAccommodations: { select: { id: true, customerName: true, checkIn: true, checkOut: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });
    if (!booking) return false;

    await tx.banquetBooking.update({
      where: { id },
      data: { deletedAt: new Date(), deletedById: by.id, linkedAccommodations: { set: [] } },
    });
    await tx.cancellationLog.create({
      data: {
        action: "DELETE",
        bookingType: "BANQUET",
        bookingId: booking.id,
        resourceName: booking.resource.name,
        customerName: booking.customerName,
        phone: booking.phone ?? undefined,
        bookingPeriod: `${formatThaiDate(booking.eventDate)} ${formatTime(booking.startTime)}-${formatTime(booking.endTime)}`,
        reason,
        cancelledById: by.id,
        snapshot: toJson(booking),
      },
    });
    return true;
  });
}
