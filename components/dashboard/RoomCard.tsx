"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BedDouble, Loader2, PawPrint, Plus, Sparkles, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { HOUSEKEEPING_STATUS_LABELS } from "@/lib/labels";
import { formatTime, formatThaiDate, toBangkokWallClock, THAI_MONTHS } from "@/lib/dates";
import { accommodationExpectedTotal, sumPaid } from "@/lib/payment-calc";
import { PaymentStatusPill } from "@/components/payment/PaymentStatusPill";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
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

const HOUSEKEEPING_DOT_CLASSES: Record<string, string> = {
  READY: "bg-emerald-500",
  NEEDS_CLEANING: "bg-amber-500",
  OUT_OF_SERVICE: "bg-red-500",
};

export function RoomCard({
  resource,
  dateStr,
  readOnly,
}: {
  resource: ResourceWithBooking;
  dateStr: string;
  readOnly: boolean;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const [extending, setExtending] = useState(false);
  const [togglingService, setTogglingService] = useState(false);

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
      router.refresh();
    } else {
      showToast("อัปเดตสถานะห้องไม่สำเร็จ");
    }
  }

  async function handleExtend() {
    if (!b) return;
    setExtending(true);
    const res = await fetch(`/api/accommodation-bookings/${b.id}/extend`, { method: "POST" });
    setExtending(false);
    if (res.ok) {
      showToast("บันทึกพักต่อ +1 คืนแล้ว");
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      showToast(body.error ?? "พักต่อไม่สำเร็จ");
    }
  }

  async function handleToggleService() {
    if (!b) return;
    setTogglingService(true);
    const res = await fetch(`/api/accommodation-bookings/${b.id}/additional-service`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ needsAdditionalService: !b.needsAdditionalService }),
    });
    setTogglingService(false);
    if (res.ok) {
      showToast("บันทึกแล้ว");
      router.refresh();
    } else {
      showToast("บันทึกไม่สำเร็จ");
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

          {b && b.needsAdditionalService && !isCancelled && (
            <span className="inline-flex w-fit items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
              มีบริการเพิ่มเติม
            </span>
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

          <div className="mt-1 flex items-center gap-1.5 border-t border-cream-100 pt-1.5" onClick={(e) => e.stopPropagation()}>
            <span className={cn("h-2 w-2 shrink-0 rounded-full", HOUSEKEEPING_DOT_CLASSES[resource.housekeepingStatus])} />
            <Select
              className="h-7 py-0 text-xs"
              value={resource.housekeepingStatus}
              disabled={statusSaving}
              onChange={(e) => handleStatusChange(e.target.value)}
            >
              {Object.entries(HOUSEKEEPING_STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
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
              {addonNames && addonNames.length > 0 && (
                <div className="flex items-start justify-between gap-2">
                  <span className="shrink-0 text-ink-500">บริการเสริม</span>
                  <span className="text-right font-medium text-ink-900">{addonNames.join(", ")}</span>
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
              <div className="flex flex-col gap-2 rounded-md bg-cream-100 p-3">
                <p className="text-xs font-semibold text-forest-800">งานแม่บ้าน</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={handleExtend} disabled={extending}>
                    {extending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    พักต่อ +1 คืน
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={b.needsAdditionalService ? "gold" : "outline"}
                    onClick={handleToggleService}
                    disabled={togglingService}
                  >
                    {togglingService && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {b.needsAdditionalService ? "มีบริการเพิ่มเติม ✓" : "ทำเครื่องหมายมีบริการเพิ่มเติม"}
                  </Button>
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
