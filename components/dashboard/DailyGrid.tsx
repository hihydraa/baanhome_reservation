import Link from "next/link";
import { Plus, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { ZONE_LABELS } from "@/lib/labels";
import { toDateOnlyString } from "@/lib/dates";
import type { Prisma, Resource } from "@prisma/client";

type BookingWithRelations = Prisma.AccommodationBookingGetPayload<{
  include: { addons: { include: { service: true } }; payment: true };
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
  const addonNames = b?.addons.map((a) => a.service?.name ?? a.description).filter(Boolean) as
    | string[]
    | undefined;
  const visibleAddons = addonNames?.slice(0, 2) ?? [];
  const extraAddonCount = (addonNames?.length ?? 0) - visibleAddons.length;

  const cardBody = (
    <div
      className={cn(
        "relative flex h-full flex-col overflow-hidden rounded-md border border-cream-200 bg-white shadow-sm transition-shadow hover:shadow-md",
        b && "border-gold-400"
      )}
    >
      <div
        className={cn(
          "px-2 py-2 text-center text-base font-semibold text-forest-900",
          b ? "bg-gold-300" : "bg-cream-200"
        )}
      >
        {resource.name}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-2.5 text-sm leading-tight">
        <div className="flex gap-1">
          <span className="shrink-0 text-ink-400">K.</span>
          <span className="min-w-0 flex-1 truncate text-ink-900">{b?.customerName || "—"}</span>
        </div>
        <div className="flex gap-1">
          <span className="shrink-0 text-ink-400">T.</span>
          <span className="min-w-0 flex-1 truncate text-ink-900">{b?.phone || "—"}</span>
        </div>

        {visibleAddons.length > 0 && (
          <div className="flex flex-wrap gap-1 py-0.5">
            {visibleAddons.map((name, i) => (
              <span
                key={i}
                className="inline-flex max-w-full items-center gap-1 rounded-full bg-forest-700/10 px-2 py-0.5 text-xs font-medium text-forest-800"
              >
                <Sparkles className="h-3 w-3 shrink-0" />
                <span className="truncate">{name}</span>
              </span>
            ))}
            {extraAddonCount > 0 && (
              <span className="inline-flex items-center rounded-full bg-forest-700/10 px-2 py-0.5 text-xs font-medium text-forest-800">
                +{extraAddonCount}
              </span>
            )}
          </div>
        )}

        <div className="mt-auto flex items-center justify-between border-t border-cream-100 pt-1.5">
          <span className="text-ink-400">Total</span>
          <span className="text-base font-semibold text-ink-900">
            {total != null ? total.toLocaleString("th-TH") : "—"}
          </span>
        </div>
        {!b && !readOnly && (
          <div className="flex items-center gap-1 pt-0.5 text-gold-600">
            <Plus className="h-4 w-4" />
            <span>จองห้องนี้</span>
          </div>
        )}
      </div>
    </div>
  );

  if (readOnly) {
    return <div className="h-full min-w-0">{cardBody}</div>;
  }

  const href = b
    ? `/accommodation/${b.id}`
    : `/accommodation?newResource=${resource.id}&date=${dateStr}`;

  return (
    <Link href={href} className="block h-full min-w-0">
      {cardBody}
    </Link>
  );
}
