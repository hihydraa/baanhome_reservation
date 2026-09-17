import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { toDateOnlyString } from "@/lib/dates";
import { accommodationExpectedTotal } from "@/lib/payment-calc";
import { AccommodationBookingForm, type AccommodationPaymentLedgerProps } from "@/components/accommodation/BookingForm";
import { DeleteBookingButton } from "@/components/accommodation/DeleteBookingButton";

export default async function AccommodationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [session, booking, resources, services, staff] = await Promise.all([
    auth(),
    prisma.accommodationBooking.findUnique({
      where: { id },
      include: { resource: true, addons: true, createdBy: true },
    }),
    prisma.resource.findMany({ where: { type: "ACCOMMODATION" }, orderBy: [{ zone: "asc" }, { sortOrder: "asc" }] }),
    prisma.specialService.findMany({ where: { scope: "ACCOMMODATION" }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { role: { not: "HOUSEKEEPER" } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  if (!booking) notFound();

  const payment = await prisma.payment.upsert({
    where: { accommodationBookingId: booking.id },
    create: { accommodationBookingId: booking.id },
    update: {},
    include: { entries: { include: { receivedBy: true }, orderBy: { paidAt: "asc" } } },
  });

  const initial = {
    id: booking.id,
    resourceId: booking.resourceId,
    customerName: booking.customerName,
    phone: booking.phone,
    source: booking.source,
    checkIn: toDateOnlyString(booking.checkIn),
    checkOut: toDateOnlyString(booking.checkOut),
    guestCount: booking.guestCount,
    roomPrice: booking.roomPrice != null ? Number(booking.roomPrice) : 0,
    status: booking.status,
    notes: booking.notes ?? "",
    cancelReason: "",
    addons: booking.addons.map((a) => ({
      serviceId: a.serviceId,
      description: a.description ?? "",
      quantity: a.quantity,
      price: Number(a.price),
    })),
  };

  const { nights, roomTotal, addonsTotal, expectedTotal } = accommodationExpectedTotal(booking, booking.addons);

  const ledger: AccommodationPaymentLedgerProps = {
    paymentId: payment.id,
    expectedTotal,
    breakdown: [
      { label: `ค่าห้องพัก (${nights} คืน)`, value: roomTotal },
      ...(addonsTotal > 0 ? [{ label: "ค่าบริการเสริม", value: addonsTotal }] : []),
    ],
    entries: payment.entries.map((e) => ({
      id: e.id,
      amount: Number(e.amount),
      method: e.method,
      paidAt: e.paidAt.toISOString(),
      receivedBy: e.receivedBy ? { id: e.receivedBy.id, name: e.receivedBy.name } : null,
      notes: e.notes,
      receiptNumber: e.receiptNumber,
    })),
    staffOptions: staff,
    currentUserId: session!.user.id,
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <Link href="/accommodation" className="inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 hover:underline">
          <ArrowLeft className="h-4 w-4" />
          กลับไปรายการจองห้องพัก
        </Link>
        <DeleteBookingButton id={booking.id} redirectTo="/accommodation" />
      </div>

      <div>
        <h1 className="text-xl font-semibold text-forest-800">
          {booking.resource.name} — {booking.customerName}
        </h1>
        <p className="text-sm text-ink-400">
          สร้างโดย {booking.createdBy?.name ?? "-"} เมื่อ {booking.createdAt.toLocaleString("th-TH")}
        </p>
      </div>

      <div className="max-w-2xl">
        <AccommodationBookingForm
          resources={resources.map((r) => ({ ...r, price: r.price != null ? Number(r.price) : null }))}
          services={services.map((s) => ({ ...s, price: Number(s.price) }))}
          initial={initial}
          ledger={ledger}
        />
      </div>
    </div>
  );
}
