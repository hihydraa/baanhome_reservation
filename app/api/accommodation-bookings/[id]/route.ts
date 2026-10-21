import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, requireWriteAccess, requireAdmin, zodErrorResponse, errorResponse } from "@/lib/api-helpers";
import { accommodationBookingInputSchema, deleteReasonInputSchema } from "@/lib/validators";
import { parseDateOnly } from "@/lib/dates";
import { findAccommodationConflict } from "@/lib/booking-conflicts";
import { logAccommodationCancellation, softDeleteAccommodationBooking } from "@/lib/cancellation-log";
import { logBookingStatus } from "@/lib/booking-status-log";
import { upsertCustomerFromBooking } from "@/lib/customers";
import { accommodationExpectedTotal } from "@/lib/payment-calc";
import { diffAccommodationQuotation, logQuotationChange, type AccommodationQuotationSnapshot } from "@/lib/quotation-log";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { response } = await requireSession();
  if (response) return response;

  const { id } = await params;
  const booking = await prisma.accommodationBooking.findUnique({
    where: { id },
    include: {
      resource: true,
      addons: true,
      payment: { include: { entries: { include: { receivedBy: true }, orderBy: { paidAt: "asc" } } } },
      createdBy: true,
      linkedBanquetBookings: true,
    },
  });
  if (!booking) return errorResponse("ไม่พบการจอง", 404);

  return NextResponse.json(booking);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { session, response } = await requireWriteAccess();
  if (response) return response;

  const { id } = await params;
  const existing = await prisma.accommodationBooking.findUnique({
    where: { id },
    include: { resource: true, addons: { include: { service: true } } },
  });
  if (!existing) return errorResponse("ไม่พบการจอง", 404);

  const body = await req.json();
  const parsed = accommodationBookingInputSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const data = parsed.data;

  if (existing.status !== "CANCELLED" && data.status === "CANCELLED" && (data.cancelReason?.trim().length ?? 0) < 3) {
    return errorResponse("กรุณาระบุเหตุผลการยกเลิก (อย่างน้อย 3 ตัวอักษร)");
  }

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
    const updated = await tx.accommodationBooking.update({
      where: { id },
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
      },
    });
    if (existing.status !== data.status) {
      await logBookingStatus({ bookingIds: [id], fromStatus: existing.status, toStatus: data.status, user: session!.user }, tx);
    }
    return updated;
  });

  const [newResource, newServices] = await Promise.all([
    prisma.resource.findUniqueOrThrow({ where: { id: data.resourceId } }),
    prisma.specialService.findMany({ where: { id: { in: data.addons.flatMap((a) => (a.serviceId ? [a.serviceId] : [])) } } }),
  ]);
  const serviceName = new Map(newServices.map((s) => [s.id, s.name]));
  const snapshot = (input: {
    customerName: string;
    phone: string;
    resourceName: string;
    checkIn: Date;
    checkOut: Date;
    guestCount: number;
    roomPrice: number;
    addons: { name: string; quantity: number; price: number }[];
    discount: { type: "BAHT" | "PERCENT"; value: number; note: string };
  }): AccommodationQuotationSnapshot => ({
    ...input,
    total: accommodationExpectedTotal(
      { ...input, discountType: input.discount.type, discountValue: input.discount.value },
      input.addons
    ).expectedTotal,
  });
  const before = snapshot({
    customerName: existing.customerName,
    phone: existing.phone,
    resourceName: existing.resource.name,
    checkIn: existing.checkIn,
    checkOut: existing.checkOut,
    guestCount: existing.guestCount,
    roomPrice: Number(existing.roomPrice ?? 0),
    addons: existing.addons.map((a) => ({ name: a.service?.name || a.description || "-", quantity: a.quantity, price: Number(a.price) })),
    discount: { type: existing.discountType, value: Number(existing.discountValue), note: existing.discountNote ?? "" },
  });
  const after = snapshot({
    customerName: booking.customerName,
    phone: booking.phone,
    resourceName: newResource.name,
    checkIn: booking.checkIn,
    checkOut: booking.checkOut,
    guestCount: booking.guestCount,
    roomPrice: Number(booking.roomPrice ?? 0),
    addons: data.addons.map((a) => ({
      name: (a.serviceId && serviceName.get(a.serviceId)) || a.description || "-",
      quantity: a.quantity,
      price: a.price,
    })),
    discount: { type: data.discountType, value: data.discountValue, note: data.discountNote || "" },
  });
  await logQuotationChange({
    accommodationBookingId: id,
    userId: session!.user.id,
    userName: session!.user.name ?? session!.user.username,
    changes: diffAccommodationQuotation(before, after),
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

  const deleted = await softDeleteAccommodationBooking(id, parsed.data.reason, { id: session!.user.id });
  if (!deleted) return errorResponse("ไม่พบการจอง", 404);
  return NextResponse.json({ ok: true });
}
