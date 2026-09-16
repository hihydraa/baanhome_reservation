import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatThaiDate, formatTime } from "@/lib/dates";
import { BanquetForm } from "@/components/banquet/BanquetForm";
import { DeleteBanquetButton } from "@/components/banquet/DeleteBanquetButton";

export default async function BanquetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [booking, resources, accommodationBookings] = await Promise.all([
    prisma.banquetBooking.findUnique({
      where: { id },
      include: { resource: true, payment: true, linkedAccommodations: { include: { resource: true } }, createdBy: true },
    }),
    prisma.resource.findMany({ where: { type: "BANQUET" }, orderBy: [{ sortOrder: "asc" }] }),
    prisma.accommodationBooking.findMany({
      where: { status: { not: "CANCELLED" } },
      include: { resource: true },
      orderBy: { checkIn: "desc" },
      take: 50,
    }),
  ]);

  if (!booking) notFound();

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
    foodService: booking.foodService ?? "",
    linkedAccommodationIds: booking.linkedAccommodations.map((a) => a.id),
    status: booking.status,
    notes: booking.notes ?? "",
    cancelReason: "",
    payment: booking.payment
      ? {
          totalAmount: Number(booking.payment.totalAmount),
          depositAmount: Number(booking.payment.depositAmount),
          status: booking.payment.status,
          method: booking.payment.method,
          notes: booking.payment.notes ?? "",
        }
      : { totalAmount: 0, depositAmount: 0, status: "DEPOSIT" as const, method: "CASH" as const, notes: "" },
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
        <BanquetForm resources={resources} accommodationOptions={accommodationOptions} initialOverrides={initial} />
      </div>
    </div>
  );
}
