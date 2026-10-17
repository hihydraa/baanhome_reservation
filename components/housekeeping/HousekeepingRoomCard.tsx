"use client";

import { useState } from "react";
import { AlertTriangle, Brush, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast-provider";
import { useScrollSafeRefresh } from "@/lib/use-scroll-safe-refresh";
import { HOUSEKEEPING_STATUS_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";

export type HousekeepingRoom = {
  id: string;
  name: string;
  status: "READY" | "NEEDS_CLEANING" | "OUT_OF_SERVICE";
  /** Today's situation for the room, e.g. "เช็คเอาท์วันนี้" — never includes guest details. */
  context: string;
  lastChange: string | null;
};

const STATUS_STYLES = {
  READY: { icon: CheckCircle2, classes: "border-emerald-300 bg-emerald-50 text-emerald-800" },
  NEEDS_CLEANING: { icon: Brush, classes: "border-amber-300 bg-amber-50 text-amber-800" },
  OUT_OF_SERVICE: { icon: AlertTriangle, classes: "border-red-300 bg-red-50 text-red-800" },
} as const;

/** One room for the housekeeper: current status and large one-tap buttons to record the change. */
export function HousekeepingRoomCard({ room }: { room: HousekeepingRoom }) {
  const { showToast } = useToast();
  const refresh = useScrollSafeRefresh();
  const [saving, setSaving] = useState(false);
  const { icon: StatusIcon, classes } = STATUS_STYLES[room.status];

  async function setStatus(value: HousekeepingRoom["status"]) {
    setSaving(true);
    const res = await fetch(`/api/resources/${room.id}/housekeeping-status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ housekeepingStatus: value }),
    });
    setSaving(false);
    if (res.ok) {
      showToast(`${room.name}: ${HOUSEKEEPING_STATUS_LABELS[value]}`);
      refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      showToast(body.error ?? `บันทึกไม่สำเร็จ (${res.status})`);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-cream-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-lg font-semibold text-forest-800">{room.name}</p>
          <p className="text-xs text-ink-500">{room.context}</p>
        </div>
        <span className={cn("flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-semibold", classes)}>
          <StatusIcon className="h-4 w-4" />
          {HOUSEKEEPING_STATUS_LABELS[room.status]}
        </span>
      </div>

      {room.status === "NEEDS_CLEANING" && (
        <Button type="button" variant="gold" size="lg" disabled={saving} onClick={() => setStatus("READY")}>
          <CheckCircle2 className="h-5 w-5" />
          ทำความสะอาดเสร็จแล้ว
        </Button>
      )}
      {room.status === "OUT_OF_SERVICE" && (
        <Button type="button" variant="gold" size="lg" disabled={saving} onClick={() => setStatus("READY")}>
          <CheckCircle2 className="h-5 w-5" />
          ซ่อมเสร็จ / พร้อมขาย
        </Button>
      )}
      {room.status === "READY" && (
        <Button type="button" variant="subtle" size="lg" disabled={saving} onClick={() => setStatus("NEEDS_CLEANING")}>
          <Brush className="h-5 w-5" />
          แจ้งต้องทำความสะอาด
        </Button>
      )}
      {room.status !== "OUT_OF_SERVICE" && (
        <Button type="button" variant="outline" size="sm" disabled={saving} onClick={() => setStatus("OUT_OF_SERVICE")}>
          <AlertTriangle className="h-4 w-4" />
          แจ้งชำรุด / ใช้งานไม่ได้
        </Button>
      )}

      {room.lastChange && <p className="text-xs text-ink-400">ล่าสุด: {room.lastChange}</p>}
    </div>
  );
}
