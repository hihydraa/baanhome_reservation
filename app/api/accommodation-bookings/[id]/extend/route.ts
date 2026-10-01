import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, errorResponse } from "@/lib/api-helpers";
import { findAccommodationConflict } from "@/lib/booking-conflicts";

type Params = { params: Promise<{ id: string }> };

/** "พักต่อ" — any logged-in role can push a stay's checkout forward by one night. */
export async function POST(_req: Request, { params }: Params) {
  const { response } = await requireSession();
  if (response) return response;

  const { id } = await params;
  const booking = await prisma.accommodationBooking.findUnique({ where: { id } });
  if (!booking) return errorResponse("ไม่พบรายการจองนี้", 404);
  if (booking.status === "CANCELLED" || booking.status === "CHECKED_OUT") {
    return errorResponse("การจองนี้ไม่สามารถพักต่อได้ (ยกเลิกหรือเช็คเอาท์ไปแล้ว)");
  }

  const newCheckOut = new Date(booking.checkOut);
  newCheckOut.setUTCDate(newCheckOut.getUTCDate() + 1);

  const conflict = await findAccommodationConflict({
    resourceId: booking.resourceId,
    checkIn: booking.checkOut,
    checkOut: newCheckOut,
    excludeBookingId: booking.id,
  });
  if (conflict) {
    return errorResponse(`ไม่สามารถพักต่อได้ — คืนถัดไปมีการจองอื่น (${conflict.customerName}) อยู่แล้ว`, 409);
  }

  const updated = await prisma.accommodationBooking.update({
    where: { id },
    data: { checkOut: newCheckOut, extensionCount: { increment: 1 } },
  });

  return NextResponse.json(updated);
}
