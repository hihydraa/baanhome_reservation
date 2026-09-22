import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { formatThaiDate, formatTime } from "@/lib/dates";
import { banquetExpectedTotal } from "@/lib/payment-calc";
import { BanquetForm, type BanquetPaymentLedgerProps } from "@/components/banquet/BanquetForm";
import { DeleteBanquetButton } from "@/components/banquet/DeleteBanquetButton";

export default async function BanquetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [session, booking, resources, accommodationBookings, staff, services, customers] = await Promise.all([
    auth(),
    prisma.banquetBooking.findUnique({
      where: { id },
      include: {
        resource: true,
        addons: { include: { service: true } },
        linkedAccommodations: { include: { resource: true } },
        createdBy: true,
      },
    }),
    prisma.resource.findMany({ where: { type: "BANQUET" }, orderBy: [{ sortOrder: "asc" }] }),
    prisma.accommodationBooking.findMany({
      where: { status: { not: "CANCELLED" } },
      include: { resource: true },
      orderBy: { checkIn: "desc" },
      take: 50,
    }),
    prisma.user.findMany({ where: { role: { not: "HOUSEKEEPER" } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.specialService.findMany({ where: { scope: "BANQUET" }, orderBy: { name: "asc" } }),
    prisma.customer.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!booking) notFound();

  const payment = await prisma.payment.upsert({
    where: { banquetBookingId: booking.id },
    create: { banquetBookingId: booking.id },
    update: {},
    include: { entries: { include: { receivedBy: true }, orderBy: { paidAt: "asc" } } },
  });

  const accommodationOptions = accommodationBookings.map((b) => ({
    id: b.id,
    label: `${b.customerName} — ${b.resource.name} (${formatThaiDate(b.checkIn)})`,
  }));

  const initial = {
    id: booking.id,
    resourceId: booking.resourceId,
    customerName: booking.customerName,
    phone: booking.phone ?? "",
    eventDate: booking.eventDate.toISOString().slice(0, 10),
    startTime: formatTime(booking.startTime),
    endTime: formatTime(booking.endTime),
    eventType: booking.eventType,
    headcount: booking.headcount,
    linkedAccommodationIds: booking.linkedAccommodations.map((a) => a.id),
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

  const { roomTotal, addonsTotal, expectedTotal } = banquetExpectedTotal(booking, booking.resource, booking.addons);

  const ledger: BanquetPaymentLedgerProps = {
    paymentId: payment.id,
    expectedTotal,
    breakdown: [
      { label: "ค่าห้องจัดเลี้ยง", value: roomTotal },
      ...(addonsTotal > 0 ? [{ label: "ค่าบริการเพิ่มเติม", value: addonsTotal }] : []),
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
        <Link href="/banquet" className="inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 hover:underline">
          <ArrowLeft className="h-4 w-4" />
          กลับไปตารางห้องจัดเลี้ยง
        </Link>
        <DeleteBanquetButton id={booking.id} redirectTo="/banquet" />
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
        <BanquetForm
          resources={resources.map((r) => ({
            ...r,
            hourlyPrice: r.hourlyPrice != null ? Number(r.hourlyPrice) : null,
            dailyPrice: r.dailyPrice != null ? Number(r.dailyPrice) : null,
          }))}
          accommodationOptions={accommodationOptions}
          services={services.map((s) => ({ ...s, price: Number(s.price) }))}
          customers={customers}
          initialOverrides={initial}
          ledger={ledger}
        />
      </div>
    </div>
  );
}
