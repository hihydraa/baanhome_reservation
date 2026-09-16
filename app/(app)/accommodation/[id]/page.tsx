import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { toDateOnlyString } from "@/lib/dates";
import { AccommodationBookingForm } from "@/components/accommodation/BookingForm";
import { DeleteBookingButton } from "@/components/accommodation/DeleteBookingButton";

export default async function AccommodationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [booking, resources, services] = await Promise.all([
    prisma.accommodationBooking.findUnique({
      where: { id },
      include: { resource: true, addons: true, payment: true, createdBy: true },
    }),
    prisma.resource.findMany({ where: { type: "ACCOMMODATION" }, orderBy: [{ zone: "asc" }, { sortOrder: "asc" }] }),
    prisma.specialService.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!booking) notFound();

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
    payment: booking.payment
      ? {
          totalAmount: Number(booking.payment.totalAmount),
          depositAmount: Number(booking.payment.depositAmount),
          status: booking.payment.status,
          method: booking.payment.method,
          notes: booking.payment.notes ?? "",
        }
      : { totalAmount: 0, depositAmount: 0, status: "PAY_LATER" as const, method: "CASH" as const, notes: "" },
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
          resources={resources}
          services={services.map((s) => ({ ...s, price: Number(s.price) }))}
          initial={initial}
        />
      </div>
    </div>
  );
}
