import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, zodErrorResponse, errorResponse } from "@/lib/api-helpers";
import { banquetBookingInputSchema } from "@/lib/validators";
import { combineDateAndTime, parseDateOnly, formatThaiDate, formatTime } from "@/lib/dates";
import { findBanquetConflict } from "@/lib/booking-conflicts";

export async function GET(req: NextRequest) {
  const { response } = await requireSession();
  if (response) return response;

  const dateParam = req.nextUrl.searchParams.get("date");
  const monthParam = req.nextUrl.searchParams.get("month"); // format YYYY-MM

  let where = {};
  if (dateParam) {
    const day = parseDateOnly(dateParam);
    const nextDay = new Date(day);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    where = { eventDate: { gte: day, lt: nextDay } };
  } else if (monthParam) {
    const [y, m] = monthParam.split("-").map(Number);
    const start = new Date(Date.UTC(y, m - 1, 1));
    const end = new Date(Date.UTC(y, m, 1));
    where = { eventDate: { gte: start, lt: end } };
  }

  const bookings = await prisma.banquetBooking.findMany({
    where,
    include: { resource: true, payment: true, linkedAccommodation: true },
    orderBy: [{ eventDate: "asc" }, { startTime: "asc" }],
  });

  return NextResponse.json(bookings);
}

export async function POST(req: NextRequest) {
  const { session, response } = await requireSession();
  if (response) return response;

  const body = await req.json();
  const parsed = banquetBookingInputSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const data = parsed.data;

  const eventDate = parseDateOnly(data.eventDate);
  const startTime = combineDateAndTime(data.eventDate, data.startTime);
  const endTime = combineDateAndTime(data.eventDate, data.endTime);

  const conflict = await findBanquetConflict({ resourceId: data.resourceId, eventDate, startTime, endTime });
  if (conflict) {
    return errorResponse(
      `ห้องนี้มีการจองซ้อนกับ "${conflict.customerName}" เวลา ${formatTime(conflict.startTime)}-${formatTime(
        conflict.endTime
      )} วันที่ ${formatThaiDate(conflict.eventDate)}`,
      409
    );
  }

  const booking = await prisma.banquetBooking.create({
    data: {
      resourceId: data.resourceId,
      customerName: data.customerName,
      phone: data.phone,
      eventDate,
      startTime,
      endTime,
      eventType: data.eventType,
      headcount: data.headcount,
      foodService: data.foodService,
      linkedAccommodationId: data.linkedAccommodationId || null,
      status: data.status,
      notes: data.notes,
      createdById: session!.user.id,
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
    },
    include: { resource: true, payment: true, linkedAccommodation: true },
  });

  return NextResponse.json(booking, { status: 201 });
}
