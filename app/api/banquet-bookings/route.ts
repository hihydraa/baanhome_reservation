import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, requireWriteAccess, zodErrorResponse, errorResponse } from "@/lib/api-helpers";
import { banquetBookingInputSchema } from "@/lib/validators";
import { combineDateAndTime, parseDateOnly, formatThaiDate, formatTime, nowBangkok } from "@/lib/dates";
import { findBanquetConflict } from "@/lib/booking-conflicts";
import { generateReceiptNumber } from "@/lib/receipt";
import { upsertCustomerFromBooking } from "@/lib/customers";

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
    include: { resource: true, addons: true, payment: { include: { entries: true } }, linkedAccommodations: true },
    orderBy: [{ eventDate: "asc" }, { startTime: "asc" }],
  });

  return NextResponse.json(bookings);
}

export async function POST(req: NextRequest) {
  const { session, response } = await requireWriteAccess();
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

  const hasInitialDeposit = !!data.initialPayment && data.initialPayment.amount > 0;
  const paidAt = nowBangkok();
  const receiptNumber = hasInitialDeposit ? await generateReceiptNumber(prisma, paidAt) : null;

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
      linkedAccommodations: { connect: data.linkedAccommodationIds.map((id) => ({ id })) },
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
    include: { resource: true, addons: true, payment: { include: { entries: true } }, linkedAccommodations: true },
  });

  await upsertCustomerFromBooking({ name: data.customerName, phone: data.phone });

  return NextResponse.json(booking, { status: 201 });
}
