import Link from "next/link";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { ZONE_LABELS } from "@/lib/labels";
import { toDateOnlyString } from "@/lib/dates";
import type { Prisma, Resource } from "@prisma/client";

type BookingWithRelations = Prisma.AccommodationBookingGetPayload<{
  include: { addons: true; payment: true };
}>;
type ResourceWithBooking = Resource & {
  booking?: BookingWithRelations;
};

export function DailyGrid({
  resourcesByZone,
  date,
  readOnly = false,
}: {
  resourcesByZone: Record<string, ResourceWithBooking[]>;
  date: Date;
  readOnly?: boolean;
}) {
  const dateStr = toDateOnlyString(date);

  return (
    <div className="flex flex-col gap-6">
      {Object.entries(resourcesByZone).map(([zone, resources]) => (
        <div key={zone} className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-forest-800">{ZONE_LABELS[zone] ?? zone}</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
            {resources.map((r) => (
              <RoomCard key={r.id} resource={r} dateStr={dateStr} readOnly={readOnly} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function RoomCard({
  resource,
  dateStr,
  readOnly,
}: {
  resource: ResourceWithBooking;
  dateStr: string;
  readOnly: boolean;
}) {
  const b = resource.booking;
  const total = b?.payment?.totalAmount != null ? Number(b.payment.totalAmount) : null;

  const cardBody = (
    <div
      className={cn(
        "relative flex h-full flex-col overflow-hidden rounded-md border border-cream-200 bg-white shadow-sm transition-shadow hover:shadow-md",
        b && "border-gold-400"
      )}
    >
      <div
        className={cn(
          "px-2 py-1 text-center text-xs font-semibold text-forest-900",
          b ? "bg-gold-300" : "bg-cream-200"
        )}
      >
        {resource.name}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-2 text-[11px] leading-tight">
        <div className="flex gap-1">
          <span className="shrink-0 text-ink-400">K.</span>
          <span className="truncate text-ink-900">{b?.customerName || "—"}</span>
        </div>
        <div className="flex gap-1">
          <span className="shrink-0 text-ink-400">T.</span>
          <span className="truncate text-ink-900">{b?.phone || "—"}</span>
        </div>
        <div className="mt-auto flex items-center justify-between border-t border-cream-100 pt-1">
          <span className="text-ink-400">Total</span>
          <span className="font-medium text-ink-900">
            {total != null ? total.toLocaleString("th-TH") : "—"}
          </span>
        </div>
        {!b && !readOnly && (
          <div className="flex items-center gap-1 pt-0.5 text-gold-600">
            <Plus className="h-3 w-3" />
            <span>จองห้องนี้</span>
          </div>
        )}
      </div>
    </div>
  );

  if (readOnly) {
    return <div className="h-full">{cardBody}</div>;
  }

  const href = b
    ? `/accommodation/${b.id}`
    : `/accommodation?newResource=${resource.id}&date=${dateStr}`;

  return (
    <Link href={href} className="block h-full">
      {cardBody}
    </Link>
  );
}
