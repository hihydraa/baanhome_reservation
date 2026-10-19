"use client";

import { useState } from "react";
import { AlertTriangle, Brush, CheckCircle2, Minus, Plus, SprayCan } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast-provider";
import { useScrollSafeRefresh } from "@/lib/use-scroll-safe-refresh";
import { HOUSEKEEPING_STATUS_LABELS } from "@/lib/labels";
import { CLEANING_TYPE_LABELS, SUPPLY_ITEMS, TRACKED_ITEMS } from "@/lib/housekeeping";
import { cn } from "@/lib/utils";

export type HousekeepingRoom = {
  id: string;
  name: string;
  status: "READY" | "NEEDS_CLEANING" | "OUT_OF_SERVICE";
  /** Today's situation for the room, e.g. "เช็คเอาท์วันนี้" — never includes guest details. */
  context: string;
  /** What was already recorded for this room today, one line per cleaning. */
  todayRecords: string[];
};

const STATUS_STYLES = {
  READY: { icon: CheckCircle2, classes: "border-emerald-300 bg-emerald-50 text-emerald-800" },
  NEEDS_CLEANING: { icon: Brush, classes: "border-amber-300 bg-amber-50 text-amber-800" },
  OUT_OF_SERVICE: { icon: AlertTriangle, classes: "border-red-300 bg-red-50 text-red-800" },
} as const;

type CleaningType = "CHECKOUT" | "STAY";

/** One selectable supply: tracked ones carry a category so the review page can audit them against billing. */
const CHOICES: { name: string; category: string | null; unit: string }[] = [
  ...TRACKED_ITEMS.map((t) => ({ name: t.label, category: t.key as string | null, unit: "" })),
  ...SUPPLY_ITEMS.map((i) => ({ name: i.name, category: null as string | null, unit: i.unit })),
];

/** One room for the housekeeper: tap it, record the cleaning (type + supplies taken out). */
export function HousekeepingRoomCard({ room }: { room: HousekeepingRoom }) {
  const { showToast } = useToast();
  const refresh = useScrollSafeRefresh();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<CleaningType | null>(null);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [other, setOther] = useState("");
  const [otherQty, setOtherQty] = useState(1);
  const [notes, setNotes] = useState("");
  const [repair, setRepair] = useState("");
  const [saving, setSaving] = useState(false);
  const { icon: StatusIcon, classes } = STATUS_STYLES[room.status];

  function openDialog() {
    setType(null);
    setQty({});
    setOther("");
    setOtherQty(1);
    setNotes("");
    setRepair("");
    setOpen(true);
  }

  function bump(name: string, delta: number) {
    setQty((q) => ({ ...q, [name]: Math.max(0, Math.min(99, (q[name] ?? 0) + delta)) }));
  }

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

  async function saveCleaning() {
    if (!type) return;
    const items = CHOICES.filter((c) => (qty[c.name] ?? 0) > 0).map((c) => ({
      name: c.name,
      category: c.category,
      quantity: qty[c.name],
    }));
    if (other.trim()) items.push({ name: other.trim(), category: null, quantity: otherQty });

    setSaving(true);
    const res = await fetch("/api/housekeeping/records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resourceId: room.id, type, items, notes: notes.trim() || undefined, repairNote: repair.trim() || undefined }),
    });
    setSaving(false);
    if (res.ok) {
      showToast(`บันทึกการทำความสะอาด ${room.name} แล้ว`);
      setOpen(false);
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

        <Button type="button" variant={room.status === "NEEDS_CLEANING" ? "gold" : "default"} size="lg" onClick={openDialog}>
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
            {room.todayRecords.map((line, i) => (
              <li key={i}>✓ {line}</li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>ทำความสะอาด {room.name}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 text-sm">
            <div className="flex flex-col gap-2">
              <p className="font-medium text-ink-900">1. ทำความสะอาดเพราะอะไร</p>
              <div className="grid grid-cols-2 gap-2">
                {(["CHECKOUT", "STAY"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={cn(
                      "rounded-lg border-2 px-3 py-3 text-center font-semibold",
                      type === t ? "border-forest-700 bg-forest-700 text-cream-50" : "border-cream-200 bg-white text-ink-900"
                    )}
                  >
                    {CLEANING_TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
              {type === "CHECKOUT" && (
                <p className="text-xs text-ink-400">เมื่อบันทึก ห้องจะเปลี่ยนเป็น &quot;พร้อมขาย&quot; อัตโนมัติ</p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <p className="font-medium text-ink-900">2. เบิกอะไรไปบ้าง (ไม่เบิกให้ข้าม)</p>
              <div className="flex flex-col divide-y divide-cream-100 rounded-lg border border-cream-200">
                {CHOICES.map((c) => (
                  <div key={c.name} className="flex items-center justify-between gap-2 px-3 py-2">
                    <span className={cn(c.category && "font-medium text-forest-800")}>
                      {c.name}
                      {c.unit && <span className="ml-1 text-xs font-normal text-ink-400">({c.unit})</span>}
                      {c.category && <span className="ml-1 text-xs font-normal text-gold-700">(บริการเสริม)</span>}
                    </span>
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" size="icon" aria-label={`ลด ${c.name}`} onClick={() => bump(c.name, -1)}>
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="w-6 text-center text-base font-semibold">{qty[c.name] ?? 0}</span>
                      <Button type="button" variant="outline" size="icon" aria-label={`เพิ่ม ${c.name}`} onClick={() => bump(c.name, 1)}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                <div className="flex items-center gap-2 px-3 py-2">
                  <Input placeholder="อื่นๆ (ระบุ)" value={other} onChange={(e) => setOther(e.target.value)} />
                  <Input
                    type="number"
                    min={1}
                    max={99}
                    className="w-20"
                    value={otherQty}
                    onChange={(e) => setOtherQty(Math.max(1, Number(e.target.value) || 1))}
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <p className="font-medium text-ink-900">3. แจ้งซ่อม (ถ้ามี)</p>
              <Textarea value={repair} onChange={(e) => setRepair(e.target.value)} rows={2} placeholder="เช่น หลอดไฟห้องน้ำเสีย" />
            </div>

            <div className="flex flex-col gap-2">
              <p className="font-medium text-ink-900">4. หมายเหตุ (ถ้ามี)</p>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>

            <Button type="button" variant="gold" size="lg" disabled={!type || saving} onClick={saveCleaning}>
              {saving ? "กำลังบันทึก..." : "บันทึกการทำความสะอาด"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
