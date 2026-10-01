"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useScrollSafeRefresh } from "@/lib/use-scroll-safe-refresh";
import Link from "next/link";
import {
  AlertTriangle,
  BedDouble,
  Brush,
  CheckCircle2,
  ChevronDown,
  Loader2,
  PawPrint,
  Plus,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { HOUSEKEEPING_STATUS_LABELS } from "@/lib/labels";
import { formatTime, formatThaiDate, toBangkokWallClock, THAI_MONTHS } from "@/lib/dates";
import { accommodationExpectedTotal, sumPaid } from "@/lib/payment-calc";
import { PaymentStatusPill } from "@/components/payment/PaymentStatusPill";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast-provider";
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

const HOUSEKEEPING_STYLES: Record<string, { icon: LucideIcon; classes: string }> = {
  READY: { icon: CheckCircle2, classes: "border-emerald-300 bg-emerald-50 text-emerald-800" },
  NEEDS_CLEANING: { icon: Brush, classes: "border-amber-300 bg-amber-50 text-amber-800" },
  OUT_OF_SERVICE: { icon: AlertTriangle, classes: "border-red-300 bg-red-50 text-red-800" },
};

export function RoomCard({
  resource,
  dateStr,
  readOnly,
  services,
}: {
  resource: ResourceWithBooking;
  dateStr: string;
  readOnly: boolean;
  services: { id: string; name: string }[];
}) {
  const router = useRouter();
  const refresh = useScrollSafeRefresh();
  const { showToast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const [extending, setExtending] = useState(false);
  const [addServiceId, setAddServiceId] = useState("");
  const [addServiceQty, setAddServiceQty] = useState("1");
  const [addingService, setAddingService] = useState(false);

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
  // Group by name so re-adding the same service (which now increments in the API, but older
  // bookings may still have leftover duplicate rows) always reads as one line with a total count.
  const addonDetails = Array.from(
    (b?.addons ?? [])
      .map((a) => ({ name: a.service?.name ?? a.description, quantity: a.quantity }))
      .filter((a): a is { name: string; quantity: number } => Boolean(a.name))
      .reduce((map, a) => map.set(a.name, (map.get(a.name) ?? 0) + a.quantity), new Map<string, number>())
  ).map(([name, quantity]) => ({ name, quantity }));

  const dateRangeLabel =
    b && !isCancelled
      ? `${nights} คืน (${b.checkIn.getUTCDate()}-${b.checkOut.getUTCDate()} ${THAI_MONTHS[b.checkOut.getUTCMonth()]})`
      : null;

  async function handleStatusChange(value: string) {
    setStatusSaving(true);
    const res = await fetch(`/api/resources/${resource.id}/housekeeping-status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ housekeepingStatus: value }),
    });
    setStatusSaving(false);
    if (res.ok) {
      showToast("อัปเดตสถานะห้องแล้ว");
      refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      showToast(body.error ?? `อัปเดตสถานะห้องไม่สำเร็จ (${res.status})`);
    }
  }

  async function handleExtend() {
    if (!b) return;
    setExtending(true);
    const res = await fetch(`/api/accommodation-bookings/${b.id}/extend`, { method: "POST" });
    setExtending(false);
    if (res.ok) {
      showToast("บันทึกพักต่อ +1 คืนแล้ว");
      refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      showToast(body.error ?? "พักต่อไม่สำเร็จ");
    }
  }

  async function handleAddService() {
    if (!b || !addServiceId) return;
    setAddingService(true);
    const res = await fetch(`/api/accommodation-bookings/${b.id}/addons`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serviceId: addServiceId, quantity: Number(addServiceQty) || 1 }),
    });
    setAddingService(false);
    if (res.ok) {
      showToast("เพิ่มบริการเสริมแล้ว");
      setAddServiceId("");
      setAddServiceQty("1");
      refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      showToast(body.error ?? "เพิ่มบริการเสริมไม่สำเร็จ");
    }
  }

  function handleCardClick() {
    if (b) {
      setDialogOpen(true);
    } else if (!readOnly) {
      router.push(`/accommodation?newResource=${resource.id}&date=${dateStr}`);
    }
  }

  return (
    <div className="h-full min-w-0">
      <div
        role="button"
        tabIndex={0}
        onClick={handleCardClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") handleCardClick();
        }}
        className={cn(
          "relative flex h-full cursor-pointer flex-col overflow-hidden rounded-md border border-cream-200 bg-white shadow-sm transition-shadow hover:shadow-md",
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

          {b && b.extensionCount > 0 && !isCancelled && (
            <span className="inline-flex w-fit items-center rounded-full bg-forest-700/10 px-2 py-0.5 text-xs font-medium text-forest-800">
              พักต่อมาแล้ว {b.extensionCount} คืน
            </span>
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

          <div className="mt-1 border-t border-cream-100 pt-1.5" onClick={(e) => e.stopPropagation()}>
            {(() => {
              const { icon: StatusIcon, classes } = HOUSEKEEPING_STYLES[resource.housekeepingStatus];
              return (
                <div className={cn("relative flex items-center rounded-md border", classes)}>
                  <StatusIcon className="pointer-events-none absolute left-2 h-4 w-4 shrink-0" />
                  <select
                    className="h-8 w-full appearance-none bg-transparent pl-7 pr-7 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 disabled:cursor-not-allowed disabled:opacity-50"
                    value={resource.housekeepingStatus}
                    disabled={statusSaving}
                    onChange={(e) => handleStatusChange(e.target.value)}
                  >
                    {Object.entries(HOUSEKEEPING_STATUS_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 h-3.5 w-3.5 shrink-0 opacity-60" />
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {b && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {resource.name} — {b.customerName}
              </DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-2.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-ink-500">สถานะ</span>
                <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", STATUS_TAG_CLASSES[b.status])}>
                  {STATUS_TAG_LABELS[b.status]}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-500">เบอร์โทร</span>
                <span className="font-medium text-ink-900">{b.phone || "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-500">วันที่เข้าพัก</span>
                <span className="font-medium text-ink-900">{formatThaiDate(b.checkIn)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-500">วันที่เช็คเอาท์ (ปัจจุบัน)</span>
                <span className="font-medium text-ink-900">{formatThaiDate(b.checkOut)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-500">จำนวนผู้เข้าพัก</span>
                <span className="font-medium text-ink-900">{b.guestCount} ท่าน</span>
              </div>
              {b.extensionCount > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-ink-500">พักต่อมาแล้ว</span>
                  <span className="font-medium text-ink-900">{b.extensionCount} คืน</span>
                </div>
              )}
              {addonDetails && addonDetails.length > 0 && (
                <div className="flex flex-col gap-1">
                  <span className="text-ink-500">บริการเสริมที่มีอยู่</span>
                  <ul className="flex flex-col gap-0.5">
                    {addonDetails.map((a, i) => (
                      <li key={i} className="flex items-center gap-1.5 font-medium text-ink-900">
                        <span className="h-1 w-1 shrink-0 rounded-full bg-forest-600" />
                        {a.name}
                        {a.quantity > 1 && <span className="text-ink-500"> × {a.quantity}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {b.notes && (
                <div className="flex flex-col gap-1">
                  <span className="text-ink-500">หมายเหตุ</span>
                  <span className="font-medium text-ink-900">{b.notes}</span>
                </div>
              )}
            </div>

            {!isCancelled && !isCheckedOut && (
              <div className="flex flex-col gap-3 rounded-md bg-cream-100 p-3">
                <p className="text-xs font-semibold text-forest-800">งานแม่บ้าน</p>
                <Button type="button" size="sm" variant="outline" className="self-start" onClick={handleExtend} disabled={extending}>
                  {extending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  พักต่อ +1 คืน
                </Button>

                <div className="flex flex-col gap-1.5 border-t border-cream-200 pt-2.5">
                  <p className="text-xs font-medium text-ink-600">เพิ่มบริการเสริม</p>
                  <div className="flex items-center gap-1.5">
                    <Select
                      className="h-9 flex-1 text-sm"
                      value={addServiceId}
                      onChange={(e) => setAddServiceId(e.target.value)}
                    >
                      <option value="">เลือกบริการ…</option>
                      {services.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </Select>
                    <input
                      type="number"
                      min={1}
                      value={addServiceQty}
                      onChange={(e) => setAddServiceQty(e.target.value)}
                      className="h-9 w-14 rounded-md border border-cream-200 bg-white px-2 text-center text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="gold"
                      onClick={handleAddService}
                      disabled={addingService || !addServiceId}
                    >
                      {addingService ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "เพิ่ม"}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {!readOnly && (
              <DialogFooter>
                <Button asChild variant="gold">
                  <Link href={`/accommodation/${b.id}`}>ไปหน้าจัดการการจองแบบเต็ม</Link>
                </Button>
              </DialogFooter>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
