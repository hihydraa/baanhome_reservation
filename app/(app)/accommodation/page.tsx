import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { BookingTable } from "@/components/accommodation/BookingTable";
import { AccommodationPageClient } from "./AccommodationPageClient";

export default async function AccommodationPage() {
  const [resources, bookings, services, customers] = await Promise.all([
    prisma.resource.findMany({
      where: { type: "ACCOMMODATION" },
      orderBy: [{ zone: "asc" }, { sortOrder: "asc" }],
    }),
    prisma.accommodationBooking.findMany({
      include: { resource: true, addons: true, payment: { include: { entries: true } } },
      orderBy: { checkIn: "desc" },
      take: 100,
    }),
    prisma.specialService.findMany({ where: { scope: "ACCOMMODATION" }, orderBy: { name: "asc" } }),
    prisma.customer.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold text-forest-800">จองห้องพัก</h1>
        <Suspense>
          <AccommodationPageClient
            resources={resources.map((r) => ({ ...r, price: r.price != null ? Number(r.price) : null }))}
            services={services.map((s) => ({ ...s, price: Number(s.price) }))}
            customers={customers}
          />
        </Suspense>
      </div>

      <BookingTable bookings={bookings} />
    </div>
  );
}
