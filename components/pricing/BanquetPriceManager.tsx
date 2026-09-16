"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast-provider";

export type BanquetPriceRow = {
  id: string;
  name: string;
  roomType: string | null;
  capacity: number | null;
  hourlyPrice: number | null;
  dailyPrice: number | null;
  priceCondition: string | null;
  equipment: string | null;
};

export function BanquetPriceManager({ rows }: { rows: BanquetPriceRow[] }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [editing, setEditing] = useState<BanquetPriceRow | null>(null);
  const [roomType, setRoomType] = useState("");
  const [capacity, setCapacity] = useState(0);
  const [hourlyPrice, setHourlyPrice] = useState(0);
  const [dailyPrice, setDailyPrice] = useState(0);
  const [priceCondition, setPriceCondition] = useState("");
  const [equipment, setEquipment] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openEdit(row: BanquetPriceRow) {
    setEditing(row);
    setRoomType(row.roomType ?? "");
    setCapacity(row.capacity ?? 0);
    setHourlyPrice(row.hourlyPrice ?? 0);
    setDailyPrice(row.dailyPrice ?? 0);
    setPriceCondition(row.priceCondition ?? "");
    setEquipment(row.equipment ?? "");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    setError(null);

    const res = await fetch(`/api/resources/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomType,
        capacity,
        hourlyPrice,
        dailyPrice,
        priceCondition: priceCondition || null,
        equipment,
      }),
    });

    setSaving(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "เกิดข้อผิดพลาด");
      return;
    }

    showToast(`บันทึกราคา "${editing.name}" แล้ว`);
    setEditing(null);
    router.refresh();
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ห้อง</TableHead>
            <TableHead>ประเภท</TableHead>
            <TableHead>รองรับสูงสุด</TableHead>
            <TableHead>ราคา/ชั่วโมง</TableHead>
            <TableHead>ราคาเหมาทั้งวัน</TableHead>
            <TableHead>เงื่อนไขพิเศษ</TableHead>
            <TableHead>อุปกรณ์หลัก</TableHead>
            <TableHead className="text-right">จัดการ</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-medium">{r.name}</TableCell>
              <TableCell>{r.roomType ? <Badge variant="outline">{r.roomType}</Badge> : "-"}</TableCell>
              <TableCell>{r.capacity != null ? `${r.capacity} คน` : "-"}</TableCell>
              <TableCell>{r.hourlyPrice != null ? `${r.hourlyPrice.toLocaleString("th-TH")} บาท` : "-"}</TableCell>
              <TableCell>{r.dailyPrice != null ? `${r.dailyPrice.toLocaleString("th-TH")} บาท` : "-"}</TableCell>
              <TableCell className="max-w-xs text-sm text-ink-600">{r.priceCondition || "-"}</TableCell>
              <TableCell className="max-w-xs text-sm text-ink-600">{r.equipment || "-"}</TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="icon" onClick={() => openEdit(r)}>
                  <Pencil className="h-4 w-4 text-forest-700" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>แก้ไขราคา — {editing?.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>ประเภท</Label>
                <Input value={roomType} onChange={(e) => setRoomType(e.target.value)} placeholder="เช่น VIP เล็ก" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>รองรับสูงสุด (คน)</Label>
                <Input
                  type="number"
                  min={0}
                  value={capacity === 0 ? "" : capacity}
                  onChange={(e) => setCapacity(e.target.value === "" ? 0 : Number(e.target.value))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>ราคา/ชั่วโมง (บาท)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={hourlyPrice === 0 ? "" : hourlyPrice}
                  onChange={(e) => setHourlyPrice(e.target.value === "" ? 0 : Number(e.target.value))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>ราคาเหมาทั้งวัน (บาท)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={dailyPrice === 0 ? "" : dailyPrice}
                  onChange={(e) => setDailyPrice(e.target.value === "" ? 0 : Number(e.target.value))}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>เงื่อนไขพิเศษ</Label>
              <Textarea rows={2} value={priceCondition} onChange={(e) => setPriceCondition(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>อุปกรณ์หลัก</Label>
              <Textarea rows={2} value={equipment} onChange={(e) => setEquipment(e.target.value)} />
            </div>
            {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <Button type="submit" variant="gold" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              บันทึก
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
