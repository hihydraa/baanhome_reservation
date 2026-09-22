import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, requireWriteAccess, zodErrorResponse, errorResponse } from "@/lib/api-helpers";
import { accommodationBookingInputSchema } from "@/lib/validators";
import { parseDateOnly, nowBangkok } from "@/lib/dates";
import { findAccommodationConflict } from "@/lib/booking-conflicts";
import { generateReceiptNumber } from "@/lib/receipt";
import { upsertCustomerFromBooking } from "@/lib/customers";

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
    include: { resource: true, addons: true, payment: { include: { entries: true } } },
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

  const hasInitialDeposit = !!data.initialPayment && data.initialPayment.amount > 0;
  const paidAt = nowBangkok();
  const receiptNumber = hasInitialDeposit ? await generateReceiptNumber(prisma, paidAt) : null;

  const booking = await prisma.accommodationBooking.create({
    data: {
      resourceId: data.resourceId,
      customerName: data.customerName,
      phone: data.phone,
      source: data.source,
      checkIn,
      checkOut,
      guestCount: data.guestCount,
      roomPrice: data.roomPrice ?? null,
      status: data.status,
      notes: data.notes,
      createdById: session!.user.id,
      addons: {
        create: data.addons.map((a) => ({
          serviceId: a.serviceId || null,
          description: a.description,
          quantity: a.quantity,
          price: a.price,
        })),
      },
      payment: {
        create: {
          entries: hasInitialDeposit
            ? {
                create: {
                  amount: data.initialPayment!.amount,
                  method: data.initialPayment!.method,
                  paidAt,
                  receivedById: session!.user.id,
                  notes: data.initialPayment!.notes || "มัดจำแรกเข้า",
                  receiptNumber: receiptNumber!,
                },
              }
            : undefined,
        },
      },
    },
    include: { resource: true, addons: true, payment: { include: { entries: true } } },
  });

  await upsertCustomerFromBooking({ name: data.customerName, phone: data.phone });

  return NextResponse.json(booking, { status: 201 });
}
