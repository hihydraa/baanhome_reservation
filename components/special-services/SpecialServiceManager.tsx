"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ServiceRow = { id: string; name: string; price: number };
type Scope = "ACCOMMODATION" | "BANQUET";

export function SpecialServiceManager({ services, scope }: { services: ServiceRow[]; scope: Scope }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceRow | null>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("0");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openCreate() {
    setEditing(null);
    setName("");
    setPrice("0");
    setError(null);
    setOpen(true);
  }

  function openEdit(service: ServiceRow) {
    setEditing(service);
    setName(service.name);
    setPrice(String(service.price));
    setError(null);
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const url = editing ? `/api/special-services/${editing.id}` : "/api/special-services";
    const method = editing ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, price: Number(price), scope }),
    });

    setSaving(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "เกิดข้อผิดพลาด");
      return;
    }

    setOpen(false);
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm("ยืนยันการลบบริการนี้?")) return;
    const res = await fetch(`/api/special-services/${id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
    else {
      const body = await res.json().catch(() => ({}));
      alert(body.error ?? "ลบไม่สำเร็จ");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button variant="gold" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          เพิ่มบริการ
        </Button>
      </div>

      {services.length === 0 ? (
        <p className="rounded-lg border border-dashed border-cream-200 p-8 text-center text-sm text-ink-400">
          ยังไม่มีบริการพิเศษ
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ชื่อบริการ</TableHead>
              <TableHead>ราคา (บาท)</TableHead>
              <TableHead className="text-right">จัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {services.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell>{s.price.toLocaleString("th-TH")}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(s)}>
                      <Pencil className="h-4 w-4 text-forest-700" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)}>
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "แก้ไขบริการ" : "เพิ่มบริการใหม่"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>ชื่อบริการ</Label>
              <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น เตียงเสริม" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>ราคา (บาท)</Label>
              <Input
                required
                type="number"
                min={0}
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
            {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <Button type="submit" variant="gold" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              บันทึก
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
