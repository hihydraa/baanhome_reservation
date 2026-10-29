"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast-provider";
import { CLEANING_TYPE_LABELS, SUPPLY_ITEMS, TRACKED_ITEMS } from "@/lib/housekeeping";
import { cn } from "@/lib/utils";

export type CleaningType = "CHECKOUT" | "STAY";

export type CleaningRecordFormValue = {
  /** Set when editing an existing record. */
  id?: string;
  resourceId: string;
  type: CleaningType | null;
  /** yyyy-mm-dd; only editable for an existing record. */
  serviceDate?: string;
  /** yyyy-mm-dd the paper log shows (usually the day before the cleaning). */
  ledgerDate: string;
  items: { name: string; quantity: number }[];
  notes: string;
  repairNote: string;
};

/** One selectable supply: tracked ones carry a category so the review page can audit them against billing. */
const CHOICES: { name: string; category: string | null; unit: string; hint: string }[] = [
  ...TRACKED_ITEMS.map((t) => ({ name: t.label, category: t.key as string | null, unit: t.unit as string, hint: t.hint as string })),
  ...SUPPLY_ITEMS.map((i) => ({ name: i.name, category: null as string | null, unit: i.unit, hint: "" })),
];

/**
 * Record a room cleaning (type + supplies taken out) or correct an existing record. In edit mode the
 * room and date can be changed too, and `rooms` lists the rooms to choose from.
 */
export function CleaningRecordDialog({
  open,
  onOpenChange,
  title,
  rooms,
  initial,
  maxDate,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Rooms to pick from — only needed when editing (a new record is made from a room's own card). */
  rooms?: { id: string; name: string }[];
  initial: CleaningRecordFormValue;
  maxDate?: string;
  onSaved: () => void;
}) {
  const { showToast } = useToast();
  const isEdit = !!initial.id;
  const known = new Set(CHOICES.map((c) => c.name));

  const [resourceId, setResourceId] = useState(initial.resourceId);
  const [type, setType] = useState<CleaningType | null>(initial.type);
  const [serviceDate, setServiceDate] = useState(initial.serviceDate ?? "");
  const [ledgerDate, setLedgerDate] = useState(initial.ledgerDate);
  const [qty, setQty] = useState<Record<string, number>>(
    Object.fromEntries(initial.items.filter((i) => known.has(i.name)).map((i) => [i.name, i.quantity]))
  );
  const [others, setOthers] = useState<{ name: string; quantity: number }[]>(initial.items.filter((i) => !known.has(i.name)));
  const [notes, setNotes] = useState(initial.notes);
  const [repair, setRepair] = useState(initial.repairNote);
  const [saving, setSaving] = useState(false);

  function bump(name: string, delta: number) {
    setQty((q) => ({ ...q, [name]: Math.max(0, Math.min(99, (q[name] ?? 0) + delta)) }));
  }

  async function save() {
    if (!type) return;
    const items = [
      ...CHOICES.filter((c) => (qty[c.name] ?? 0) > 0).map((c) => ({ name: c.name, category: c.category, quantity: qty[c.name] })),
      ...others.filter((o) => o.name.trim()).map((o) => ({ name: o.name.trim(), category: null, quantity: o.quantity })),
    ];
    setSaving(true);
    const res = await fetch(isEdit ? `/api/housekeeping/records/${initial.id}` : "/api/housekeeping/records", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resourceId,
        type,
        items,
        notes: notes.trim() || undefined,
        repairNote: repair.trim() || undefined,
        ledgerDate: ledgerDate || undefined,
        ...(isEdit && serviceDate ? { serviceDate } : {}),
      }),
    });
    setSaving(false);
    if (res.ok) {
      showToast(isEdit ? "แก้ไขบันทึกแล้ว" : "บันทึกการทำความสะอาดแล้ว");
      onOpenChange(false);
      onSaved();
    } else {
      const body = await res.json().catch(() => ({}));
      showToast(body.error ?? `บันทึกไม่สำเร็จ (${res.status})`);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 text-sm">
          {isEdit && rooms && (
            <label className="flex flex-col gap-1">
              <span className="font-medium text-ink-900">ห้อง</span>
              <select className="h-10 rounded-md border border-cream-200 bg-white px-2" value={resourceId} onChange={(e) => setResourceId(e.target.value)}>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="font-medium text-ink-900">วันที่ลงบัญชี</span>
              <Input type="date" max={maxDate} value={ledgerDate} onChange={(e) => setLedgerDate(e.target.value)} />
              <span className="text-xs text-ink-400">วันที่ที่แสดงในตารางบัญชีคุมฯ (ปกติคือเมื่อวาน)</span>
            </label>
            {isEdit && (
              <label className="flex flex-col gap-1">
                <span className="font-medium text-ink-900">วันที่ทำจริง</span>
                <Input type="date" max={maxDate} value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} />
                <span className="text-xs text-ink-400">วันที่กดบันทึกจริง</span>
              </label>
            )}
          </div>

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
            {!isEdit && type === "CHECKOUT" && (
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
                    {c.hint && <span className="block text-xs font-normal text-ink-400">{c.hint}</span>}
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
              {others.map((o, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2">
                  <Input
                    placeholder="อื่นๆ (ระบุ)"
                    value={o.name}
                    onChange={(e) => setOthers((l) => l.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                  />
                  <Input
                    type="number"
                    min={1}
                    max={99}
                    className="w-20"
                    value={o.quantity}
                    onChange={(e) =>
                      setOthers((l) => l.map((x, j) => (j === i ? { ...x, quantity: Math.max(1, Number(e.target.value) || 1) } : x)))
                    }
                  />
                  <Button type="button" variant="ghost" size="icon" aria-label="ลบรายการ" onClick={() => setOthers((l) => l.filter((_, j) => j !== i))}>
                    <Minus className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <div className="px-3 py-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setOthers((l) => [...l, { name: "", quantity: 1 }])}>
                  <Plus className="h-4 w-4" />
                  เพิ่มรายการอื่นๆ
                </Button>
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

          <Button type="button" variant="gold" size="lg" disabled={!type || saving} onClick={save}>
            {saving ? "กำลังบันทึก..." : isEdit ? "บันทึกการแก้ไข" : "บันทึกการทำความสะอาด"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
