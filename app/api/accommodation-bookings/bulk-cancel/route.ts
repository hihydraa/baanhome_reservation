import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWriteAccess, zodErrorResponse } from "@/lib/api-helpers";
import { bulkCancelInputSchema } from "@/lib/validators";
import { statusLogRows } from "@/lib/booking-status-log";
import { logAccommodationCancellation } from "@/lib/cancellation-log";

/**
 * Cancels several accommodation bookings at once with one shared reason (e.g. the rooms of a charter).
 * Same effect as setting each booking's status to "ยกเลิก": the rooms free up, the status history gets a row and
 * every booking is written to the cancellation log. Bookings already cancelled are skipped.
 */
export async function POST(req: NextRequest) {
  const { session, response } = await requireWriteAccess();
  if (response) return response;

  const parsed = bulkCancelInputSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const { ids, reason } = parsed.data;

  const bookings = await prisma.accommodationBooking.findMany({
    where: { id: { in: ids }, status: { not: "CANCELLED" } },
    include: { resource: true },
  });

  // The status change and its history commit together; one failure cancels none.
  await prisma.$transaction(async (tx) => {
    for (const b of bookings) {
      await tx.accommodationBooking.update({ where: { id: b.id }, data: { status: "CANCELLED" } });
    }
    await tx.bookingStatusLog.createMany({
      data: bookings.flatMap((b) =>
        statusLogRows({ bookingIds: [b.id], fromStatus: b.status, toStatus: "CANCELLED", user: session!.user })
      ),
    });
  });

  for (const b of bookings) {
    await logAccommodationCancellation({
      bookingId: b.id,
      resourceName: b.resource.name,
      customerName: b.customerName,
      phone: b.phone,
      checkIn: b.checkIn,
      checkOut: b.checkOut,
      reason,
      cancelledById: session!.user.id,
    });
  }

  return NextResponse.json({ cancelled: bookings.length, skipped: ids.length - bookings.length });
}
