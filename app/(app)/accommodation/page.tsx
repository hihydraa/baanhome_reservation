import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { BookingTable } from "@/components/accommodation/BookingTable";
import { AccommodationPageClient } from "./AccommodationPageClient";

export default async function AccommodationPage() {
  const [resources, bookings, services] = await Promise.all([
    prisma.resource.findMany({
      where: { type: "ACCOMMODATION" },
      orderBy: [{ zone: "asc" }, { sortOrder: "asc" }],
    }),
    prisma.accommodationBooking.findMany({
      include: { resource: true, payment: true },
      orderBy: { checkIn: "desc" },
      take: 100,
    }),
    prisma.specialService.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold text-forest-800">จองห้องพัก</h1>
        <Suspense>
          <AccommodationPageClient
            resources={resources}
            services={services.map((s) => ({ ...s, price: Number(s.price) }))}
          />
        </Suspense>
      </div>

      <BookingTable bookings={bookings} />
    </div>
  );
}
