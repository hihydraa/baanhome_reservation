import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, requireWriteAccess, zodErrorResponse, errorResponse } from "@/lib/api-helpers";
import { accommodationBookingInputSchema } from "@/lib/validators";
import { parseDateOnly } from "@/lib/dates";
import { findAccommodationConflict } from "@/lib/booking-conflicts";

export async function GET(req: NextRequest) {
  const { response } = await requireSession();
  if (response) return response;

  const dateParam = req.nextUrl.searchParams.get("date");

  const where = dateParam
    ? (() => {
        const day = parseDateOnly(dateParam);
        const nextDay = new Date(day);
        nextDay.setUTCDate(nextDay.getUTCDate() + 1);
        return { checkIn: { lt: nextDay }, checkOut: { gt: day } };
      })()
    : {};

  const bookings = await prisma.accommodationBooking.findMany({
    where,
    include: { resource: true, addons: true, payment: true },
    orderBy: [{ checkIn: "asc" }],
  });

  return NextResponse.json(bookings);
}

export async function POST(req: NextRequest) {
  const { session, response } = await requireWriteAccess();
  if (response) return response;

  const body = await req.json();
  const parsed = accommodationBookingInputSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const data = parsed.data;

  const checkIn = parseDateOnly(data.checkIn);
  const checkOut = parseDateOnly(data.checkOut);

  const conflict = await findAccommodationConflict({ resourceId: data.resourceId, checkIn, checkOut });
  if (conflict) {
    return errorResponse(
      `ห้องนี้มีการจองซ้อนกับ "${conflict.customerName}" (${conflict.checkIn
        .toISOString()
        .slice(0, 10)} - ${conflict.checkOut.toISOString().slice(0, 10)})`,
      409
    );
  }

  const booking = await prisma.accommodationBooking.create({
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
      createdById: session!.user.id,
      addons: {
        create: data.addons.map((a) => ({
          type: a.type,
          description: a.description,
          quantity: a.quantity,
          price: a.price,
        })),
      },
      ...(data.payment
        ? {
            payment: {
              create: {
                totalAmount: data.payment.totalAmount,
                depositAmount: data.payment.depositAmount,
                status: data.payment.status,
                method: data.payment.method,
                notes: data.payment.notes,
                paidAt: data.payment.status === "PAID" ? new Date() : null,
              },
            },
          }
        : {}),
    },
    include: { resource: true, addons: true, payment: true },
  });

  return NextResponse.json(booking, { status: 201 });
}
