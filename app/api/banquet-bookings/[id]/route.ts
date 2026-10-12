import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, requireWriteAccess, zodErrorResponse, errorResponse } from "@/lib/api-helpers";
import { banquetBookingInputSchema } from "@/lib/validators";
import { combineDateAndTime, parseDateOnly, formatThaiDate, formatTime } from "@/lib/dates";
import { findBanquetConflict } from "@/lib/booking-conflicts";
import { logBanquetCancellation } from "@/lib/cancellation-log";
import { upsertCustomerFromBooking } from "@/lib/customers";
import { buildQuotationSnapshot, diffQuotation, logQuotationChange } from "@/lib/quotation-log";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { response } = await requireSession();
  if (response) return response;

  const { id } = await params;
  const booking = await prisma.banquetBooking.findUnique({
    where: { id },
    include: {
      resource: true,
      addons: true,
      payment: { include: { entries: { include: { receivedBy: true }, orderBy: { paidAt: "asc" } } } },
      linkedAccommodations: true,
      createdBy: true,
    },
  });
  if (!booking) return errorResponse("ไม่พบการจอง", 404);

  return NextResponse.json(booking);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { session, response } = await requireWriteAccess();
  if (response) return response;

  const { id } = await params;
  const existing = await prisma.banquetBooking.findUnique({
    where: { id },
    include: { resource: true, addons: { include: { service: true } } },
  });
  if (!existing) return errorResponse("ไม่พบการจอง", 404);

  const body = await req.json();
  const parsed = banquetBookingInputSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const data = parsed.data;

  const eventDate = parseDateOnly(data.eventDate);
  const startTime = combineDateAndTime(data.eventDate, data.startTime);
  const endTime = combineDateAndTime(data.eventDate, data.endTime);

  if (data.status !== "CANCELLED") {
    const conflict = await findBanquetConflict({
      resourceId: data.resourceId,
      eventDate,
      startTime,
      endTime,
      excludeBookingId: id,
    });
    if (conflict) {
      return errorResponse(
        `ห้องนี้มีการจองซ้อนกับ "${conflict.customerName}" เวลา ${formatTime(conflict.startTime)}-${formatTime(
          conflict.endTime
        )} วันที่ ${formatThaiDate(conflict.eventDate)}`,
        409
      );
    }
  }

  const booking = await prisma.$transaction(async (tx) => {
    await tx.banquetAddon.deleteMany({ where: { bookingId: id } });
    return tx.banquetBooking.update({
      where: { id },
      data: {
        resourceId: data.resourceId,
        customerName: data.customerName,
        phone: data.phone,
        eventDate,
        startTime,
        endTime,
        eventType: data.eventType,
        headcount: data.headcount,
        linkedAccommodations: { set: data.linkedAccommodationIds.map((linkId) => ({ id: linkId })) },
        status: data.status,
        notes: data.notes,
        discountType: data.discountType,
        discountValue: data.discountValue,
        discountNote: data.discountNote || null,
        addons: {
          create: data.addons.map((a) => ({
            serviceId: a.serviceId || null,
            description: a.description,
            quantity: a.quantity,
            price: a.price,
          })),
        },
      },
      include: {
        resource: true,
        addons: true,
        payment: { include: { entries: { include: { receivedBy: true }, orderBy: { paidAt: "asc" } } } },
        linkedAccommodations: true,
      },
    });
  });

  const [newResource, newServices] = await Promise.all([
    prisma.resource.findUniqueOrThrow({ where: { id: data.resourceId } }),
    prisma.specialService.findMany({ where: { id: { in: data.addons.flatMap((a) => (a.serviceId ? [a.serviceId] : [])) } } }),
  ]);
  const serviceName = new Map(newServices.map((s) => [s.id, s.name]));
  const before = buildQuotationSnapshot({
    ...existing,
    resource: existing.resource,
    addons: existing.addons.map((a) => ({
      name: a.service?.name || a.description || "-",
      quantity: a.quantity,
      price: Number(a.price),
    })),
    discount: { type: existing.discountType, value: Number(existing.discountValue), note: existing.discountNote ?? "" },
  });
  const after = buildQuotationSnapshot({
    ...booking,
    resource: newResource,
    addons: data.addons.map((a) => ({
      name: (a.serviceId && serviceName.get(a.serviceId)) || a.description || "-",
      quantity: a.quantity,
      price: a.price,
    })),
    discount: { type: data.discountType, value: data.discountValue, note: data.discountNote || "" },
  });
  await logQuotationChange({
    bookingId: id,
    userId: session!.user.id,
    userName: session!.user.name ?? session!.user.username,
    changes: diffQuotation(before, after),
  });

  if (existing.status !== "CANCELLED" && data.status === "CANCELLED") {
    await logBanquetCancellation({
      bookingId: booking.id,
      resourceName: existing.resource.name,
      customerName: booking.customerName,
      phone: booking.phone,
      eventDate: booking.eventDate,
      startTime: booking.startTime,
      endTime: booking.endTime,
      reason: data.cancelReason,
      cancelledById: session!.user.id,
    });
  }

  await upsertCustomerFromBooking({ name: data.customerName, phone: data.phone });

  return NextResponse.json(booking);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { response } = await requireWriteAccess();
  if (response) return response;

  const { id } = await params;
  const existing = await prisma.banquetBooking.findUnique({ where: { id } });
  if (!existing) return errorResponse("ไม่พบการจอง", 404);

  await prisma.banquetBooking.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
