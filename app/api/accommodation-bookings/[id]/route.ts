import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, zodErrorResponse, errorResponse } from "@/lib/api-helpers";
import { accommodationBookingInputSchema } from "@/lib/validators";
import { parseDateOnly } from "@/lib/dates";
import { findAccommodationConflict } from "@/lib/booking-conflicts";
import { logAccommodationCancellation } from "@/lib/cancellation-log";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { response } = await requireSession();
  if (response) return response;

  const { id } = await params;
  const booking = await prisma.accommodationBooking.findUnique({
    where: { id },
    include: { resource: true, addons: true, payment: true, createdBy: true, linkedBanquetBookings: true },
  });
  if (!booking) return errorResponse("ไม่พบการจอง", 404);

  return NextResponse.json(booking);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { session, response } = await requireSession();
  if (response) return response;

  const { id } = await params;
  const existing = await prisma.accommodationBooking.findUnique({
    where: { id },
    include: { resource: true },
  });
  if (!existing) return errorResponse("ไม่พบการจอง", 404);

  const body = await req.json();
  const parsed = accommodationBookingInputSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const data = parsed.data;

  const checkIn = parseDateOnly(data.checkIn);
  const checkOut = parseDateOnly(data.checkOut);

  if (data.status !== "CANCELLED") {
    const conflict = await findAccommodationConflict({
      resourceId: data.resourceId,
      checkIn,
      checkOut,
      excludeBookingId: id,
    });
    if (conflict) {
      return errorResponse(
        `ห้องนี้มีการจองซ้อนกับ "${conflict.customerName}" (${conflict.checkIn
          .toISOString()
          .slice(0, 10)} - ${conflict.checkOut.toISOString().slice(0, 10)})`,
        409
      );
    }
  }

  const booking = await prisma.$transaction(async (tx) => {
    await tx.accommodationAddon.deleteMany({ where: { bookingId: id } });
    return tx.accommodationBooking.update({
      where: { id },
      data: {
        resourceId: data.resourceId,
        customerName: data.customerName,
        phone: data.phone,
        source: data.source,
        checkIn,
        checkOut,
        guestCount: data.guestCount,
        status: data.status,
        notes: data.notes,
        addons: {
          create: data.addons.map((a) => ({
            type: a.type,
            description: a.description,
            quantity: a.quantity,
            price: a.price,
          })),
        },
      },
      include: { resource: true, addons: true, payment: true },
    });
  });

  if (existing.status !== "CANCELLED" && data.status === "CANCELLED") {
    await logAccommodationCancellation({
      bookingId: booking.id,
      resourceName: existing.resource.name,
      customerName: booking.customerName,
      phone: booking.phone,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      reason: data.cancelReason,
      cancelledById: session!.user.id,
    });
  }

  return NextResponse.json(booking);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { response } = await requireSession();
  if (response) return response;

  const { id } = await params;
  const existing = await prisma.accommodationBooking.findUnique({ where: { id } });
  if (!existing) return errorResponse("ไม่พบการจอง", 404);

  await prisma.accommodationBooking.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
