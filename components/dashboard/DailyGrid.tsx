import { ZONE_LABELS } from "@/lib/labels";
import { toDateOnlyString } from "@/lib/dates";
import { RoomCard } from "@/components/dashboard/RoomCard";
import type { Prisma, Resource } from "@prisma/client";

type BookingWithRelations = Prisma.AccommodationBookingGetPayload<{
  include: { addons: { include: { service: true } }; payment: { include: { entries: true } } };
}>;
type ResourceWithBooking = Resource & {
  booking?: BookingWithRelations;
  charterGroup?: { roomCount: number; totalExpected: number; totalPaid: number };
};

export function DailyGrid({
  resourcesByZone,
  date,
  readOnly = false,
  services,
}: {
  resourcesByZone: Record<string, ResourceWithBooking[]>;
  date: Date;
  readOnly?: boolean;
  services: { id: string; name: string }[];
}) {
  const dateStr = toDateOnlyString(date);

  return (
    <div className="flex flex-col gap-6">
      {Object.entries(resourcesByZone).map(([zone, resources]) => (
        <div key={zone} className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-forest-800">{ZONE_LABELS[zone] ?? zone}</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
            {resources.map((r) => (
              <RoomCard key={r.id} resource={r} dateStr={dateStr} readOnly={readOnly} services={services} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
