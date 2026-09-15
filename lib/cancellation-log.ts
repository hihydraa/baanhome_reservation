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
