import Link from "next/link";
import { BedDouble, PawPrint, Plus, Sparkles, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ZONE_LABELS } from "@/lib/labels";
import { toDateOnlyString, formatTime, formatThaiDate, toBangkokWallClock, THAI_MONTHS } from "@/lib/dates";
import { accommodationExpectedTotal, sumPaid } from "@/lib/payment-calc";
import { PaymentStatusPill } from "@/components/payment/PaymentStatusPill";
import type { Prisma, Resource } from "@prisma/client";

type BookingWithRelations = Prisma.AccommodationBookingGetPayload<{
  include: { addons: { include: { service: true } }; payment: { include: { entries: true } } };
}>;
type ResourceWithBooking = Resource & {
  booking?: BookingWithRelations;
};

function getAddonIcon(name: string): LucideIcon {
  if (name.includes("เตียง")) return BedDouble;
  if (name.includes("สัตว์เลี้ยง") || name.includes("หมา") || name.includes("แมว") || name.includes("pet")) {
    return PawPrint;
  }
  return Sparkles;
}

const STATUS_TAG_LABELS: Record<string, string> = {
  RESERVED: "จอง",
  CHECKED_IN: "เข้าพัก",
  CHECKED_OUT: "เช็คเอาท์แล้ว",
  CANCELLED: "ยกเลิก",
};

/** Solid, saturated colors on purpose — the card header itself is gold, so a subtle badge
 *  (like the shared Badge component's light variants) disappears into it. */
const STATUS_TAG_CLASSES: Record<string, string> = {
  RESERVED: "bg-amber-600 text-white",
  CHECKED_IN: "bg-emerald-600 text-white",
  CHECKED_OUT: "bg-ink-600 text-white",
  CANCELLED: "bg-red-600 text-white",
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
  const isCancelled = b?.status === "CANCELLED";
  const isCheckedOut = b?.status === "CHECKED_OUT";

  const { expectedTotal, nights } = b ? accommodationExpectedTotal(b, b.addons) : { expectedTotal: 0, nights: 0 };
  const paid = b ? sumPaid(b.payment?.entries ?? []) : 0;

  const addonNames = b?.addons.map((a) => a.service?.name ?? a.description).filter(Boolean) as
    | string[]
    | undefined;
  const visibleAddons = addonNames?.slice(0, 2) ?? [];
  const extraAddonCount = (addonNames?.length ?? 0) - visibleAddons.length;

  const dateRangeLabel =
    b && !isCancelled
      ? `${nights} คืน (${b.checkIn.getUTCDate()}-${b.checkOut.getUTCDate()} ${THAI_MONTHS[b.checkOut.getUTCMonth()]})`
      : null;

  const cardBody = (
    <div
      className={cn(
        "relative flex h-full flex-col overflow-hidden rounded-md border border-cream-200 bg-white shadow-sm transition-shadow hover:shadow-md",
        b && !isCancelled && "border-gold-400",
        isCancelled && "border-red-200"
      )}
    >
      <div className={cn("flex flex-wrap items-center justify-between gap-x-1.5 gap-y-0.5 px-2 py-2", b ? "bg-gold-300" : "bg-cream-200")}>
        <span className="truncate text-base font-semibold text-forest-900">{resource.name}</span>
        {b && (
          <span className={cn("shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-sm font-semibold shadow-sm", STATUS_TAG_CLASSES[b.status])}>
            {STATUS_TAG_LABELS[b.status]}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-2.5 text-sm leading-tight">
        {!isCancelled && (
          <>
            <div className="truncate text-ink-900">{b?.customerName || "—"}</div>
            <div className="truncate text-xs text-ink-500">{dateRangeLabel ?? "—"}</div>
          </>
        )}

        {visibleAddons.length > 0 && (
          <div className="flex flex-wrap gap-1 py-0.5">
            {visibleAddons.map((name, i) => {
              const Icon = getAddonIcon(name);
              return (
                <span
                  key={i}
                  className="inline-flex max-w-full items-center gap-1 rounded-full bg-forest-700/10 px-2 py-0.5 text-xs font-medium text-forest-800"
                >
                  <Icon className="h-3 w-3 shrink-0" />
                  <span className="truncate">{name}</span>
                </span>
              );
            })}
            {extraAddonCount > 0 && (
              <span className="inline-flex items-center rounded-full bg-forest-700/10 px-2 py-0.5 text-xs font-medium text-forest-800">
                +{extraAddonCount}
              </span>
            )}
          </div>
        )}

        {b && !isCancelled && <div className="text-sm font-semibold text-ink-900">{expectedTotal.toLocaleString("th-TH")} บาท</div>}

        <div className="mt-auto flex items-center justify-between border-t border-cream-100 pt-1.5">
          {isCancelled && b ? (
            <span className="text-xs text-red-600">ยกเลิกเมื่อ {formatThaiDate(toBangkokWallClock(b.updatedAt))}</span>
          ) : isCheckedOut && b ? (
            <span className="text-xs text-ink-500">เช็คเอาท์ {formatTime(toBangkokWallClock(b.updatedAt))} น.</span>
          ) : b ? (
            <PaymentStatusPill paid={paid} expectedTotal={expectedTotal} showIcon />
          ) : (
            <span className="text-ink-400">—</span>
          )}
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
