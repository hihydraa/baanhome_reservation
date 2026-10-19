"use client";

import { useState } from "react";
import { AlertTriangle, Brush, CheckCircle2, Pencil, SprayCan } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CleaningRecordDialog, type CleaningRecordFormValue } from "@/components/housekeeping/CleaningRecordDialog";
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
  /** What was already recorded for this room today — tapping a line opens it for editing. */
  todayRecords: { id: string; label: string; form: CleaningRecordFormValue & { id: string } }[];
};

const STATUS_STYLES = {
  READY: { icon: CheckCircle2, classes: "border-emerald-300 bg-emerald-50 text-emerald-800" },
  NEEDS_CLEANING: { icon: Brush, classes: "border-amber-300 bg-amber-50 text-amber-800" },
  OUT_OF_SERVICE: { icon: AlertTriangle, classes: "border-red-300 bg-red-50 text-red-800" },
} as const;

/** One room for the housekeeper: tap it, record the cleaning (type + supplies taken out). */
export function HousekeepingRoomCard({
  room,
  rooms,
  maxDate,
}: {
  room: HousekeepingRoom;
  rooms: { id: string; name: string }[];
  maxDate: string;
}) {
  const { showToast } = useToast();
  const refresh = useScrollSafeRefresh();
  const [open, setOpen] = useState(false);
  // Remount the dialog on every open so it always starts blank.
  const [openCount, setOpenCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<{ record: HousekeepingRoom["todayRecords"][number]; n: number } | null>(null);
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
    <>
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

        <Button
          type="button"
          variant={room.status === "NEEDS_CLEANING" ? "gold" : "default"}
          size="lg"
          onClick={() => {
            setOpenCount((n) => n + 1);
            setOpen(true);
          }}
        >
          <SprayCan className="h-5 w-5" />
          ทำความสะอาดห้องแล้ว
        </Button>

        <div className="flex gap-2">
          {room.status !== "NEEDS_CLEANING" && (
            <Button type="button" variant="subtle" size="sm" className="flex-1" disabled={saving} onClick={() => setStatus("NEEDS_CLEANING")}>
              แจ้งรอทำความสะอาด
            </Button>
          )}
          {room.status !== "OUT_OF_SERVICE" ? (
            <Button type="button" variant="outline" size="sm" className="flex-1" disabled={saving} onClick={() => setStatus("OUT_OF_SERVICE")}>
              แจ้งชำรุด
            </Button>
          ) : (
            <Button type="button" variant="outline" size="sm" className="flex-1" disabled={saving} onClick={() => setStatus("READY")}>
              ซ่อมเสร็จ / พร้อมขาย
            </Button>
          )}
        </div>

        {room.todayRecords.length > 0 && (
          <ul className="flex flex-col gap-0.5 border-t border-cream-100 pt-2 text-xs text-ink-600">
            {room.todayRecords.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  className="flex w-full items-start gap-1 rounded px-1 py-0.5 text-left hover:bg-cream-100"
                  onClick={() => setEditing({ record: r, n: Date.now() })}
                >
                  <span>✓ {r.label}</span>
                  <span className="ml-auto flex shrink-0 items-center gap-0.5 text-forest-700">
                    <Pencil className="h-3 w-3" />
                    แก้ไข
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {editing && (
        <CleaningRecordDialog
          key={editing.n}
          open
          onOpenChange={(o) => !o && setEditing(null)}
          title={`แก้ไขบันทึก ${room.name}`}
          rooms={rooms}
          maxDate={maxDate}
          initial={editing.record.form}
          onSaved={refresh}
        />
      )}

      <CleaningRecordDialog
        key={openCount}
        open={open}
        onOpenChange={setOpen}
        title={`ทำความสะอาด ${room.name}`}
        initial={{ resourceId: room.id, type: null, items: [], notes: "", repairNote: "" }}
        onSaved={refresh}
      />
    </>
  );
}
