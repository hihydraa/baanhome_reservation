import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, requireWriteAccess, requireAdmin, zodErrorResponse, errorResponse } from "@/lib/api-helpers";
import { banquetBookingInputSchema, deleteReasonInputSchema } from "@/lib/validators";
import { combineDateAndTime, parseDateOnly, formatThaiDate, formatTime } from "@/lib/dates";
import { findBanquetConflict } from "@/lib/booking-conflicts";
import { logBanquetCancellation, softDeleteBanquetBooking } from "@/lib/cancellation-log";
import { upsertCustomerFromBooking } from "@/lib/customers";
import { buildQuotationSnapshot, diffQuotation, logQuotationChange, stayLine } from "@/lib/quotation-log";

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
    include: {
      resource: true,
      addons: { include: { service: true } },
      linkedAccommodations: { include: { resource: true } },
    },
  });
  if (!existing) return errorResponse("ไม่พบการจอง", 404);

  const body = await req.json();
  const parsed = banquetBookingInputSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const data = parsed.data;

  if (existing.status !== "CANCELLED" && data.status === "CANCELLED" && (data.cancelReason?.trim().length ?? 0) < 3) {
    return errorResponse("กรุณาระบุเหตุผลการยกเลิก (อย่างน้อย 3 ตัวอักษร)");
  }

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

  const [newResource, newServices, newStays] = await Promise.all([
    prisma.resource.findUniqueOrThrow({ where: { id: data.resourceId } }),
    prisma.specialService.findMany({ where: { id: { in: data.addons.flatMap((a) => (a.serviceId ? [a.serviceId] : [])) } } }),
    prisma.accommodationBooking.findMany({ where: { id: { in: data.linkedAccommodationIds } }, include: { resource: true } }),
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
    stays: existing.linkedAccommodations.flatMap((b) => stayLine(b) ?? []),
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
    stays: newStays.flatMap((b) => stayLine(b) ?? []),
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

/**
 * ADMIN only, reason required. Soft delete — the booking and its payments are kept and the full
 * record goes to the cancellation/deletion log. Staff use status "ยกเลิก" instead.
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  const { session, response } = await requireAdmin();
  if (response) return response;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = deleteReasonInputSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const deleted = await softDeleteBanquetBooking(id, parsed.data.reason, { id: session!.user.id });
  if (!deleted) return errorResponse("ไม่พบการจอง", 404);
  return NextResponse.json({ ok: true });
}
