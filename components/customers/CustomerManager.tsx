"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Pencil, Trash2, Upload } from "lucide-react";
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
import { useToast } from "@/components/ui/toast-provider";
import { parseCsv } from "@/lib/csv";

type CustomerRow = { id: string; name: string; phone: string | null; taxId: string | null };
type ImportRow = { name: string; phone?: string; taxId?: string };

const EMPTY_FORM = { name: "", phone: "", taxId: "" };

function detectColumn(header: string[], candidates: string[]): number {
  const lower = header.map((h) => h.trim().toLowerCase());
  for (const candidate of candidates) {
    const idx = lower.indexOf(candidate);
    if (idx !== -1) return idx;
  }
  return -1;
}

export function CustomerManager({ customers }: { customers: CustomerRow[] }) {
  const router = useRouter();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerRow | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [importRows, setImportRows] = useState<ImportRow[] | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError(null);
    setOpen(true);
  }

  function openEdit(customer: CustomerRow) {
    setEditing(customer);
    setForm({ name: customer.name, phone: customer.phone ?? "", taxId: customer.taxId ?? "" });
    setError(null);
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const url = editing ? `/api/customers/${editing.id}` : "/api/customers";
    const method = editing ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
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
    if (!confirm("ยืนยันการลบลูกค้ารายนี้?")) return;
    const res = await fetch(`/api/customers/${id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
    else {
      const body = await res.json().catch(() => ({}));
      alert(body.error ?? "ลบไม่สำเร็จ");
    }
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const text = await file.text();
    const rows = parseCsv(text);
    if (rows.length === 0) {
      alert("ไฟล์ว่างเปล่า หรืออ่านไม่ได้");
      return;
    }

    const header = rows[0];
    const nameIdx = detectColumn(header, ["name", "ชื่อ", "ชื่อลูกค้า", "ชื่อ-นามสกุล"]);
    const phoneIdx = detectColumn(header, ["phone", "เบอร์", "เบอร์โทร", "เบอร์โทรศัพท์", "โทร"]);
    const taxIdIdx = detectColumn(header, ["taxid", "tax_id", "เลขนิติบุคคล", "เลขผู้เสียภาษี"]);

    if (nameIdx === -1) {
      alert('ไม่พบคอลัมน์ชื่อ — แถวแรกของไฟล์ต้องมีหัวคอลัมน์ชื่อ "name" หรือ "ชื่อ"');
      return;
    }

    const dataRows = rows.slice(1);
    const parsed: ImportRow[] = dataRows
      .map((r) => ({
        name: (r[nameIdx] ?? "").trim(),
        phone: phoneIdx !== -1 ? (r[phoneIdx] ?? "").trim() : undefined,
        taxId: taxIdIdx !== -1 ? (r[taxIdIdx] ?? "").trim() : undefined,
      }))
      .filter((r) => r.name);

    setImportRows(parsed);
    setImportOpen(true);
  }

  async function confirmImport() {
    if (!importRows) return;
    setImporting(true);
    const res = await fetch("/api/customers/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: importRows }),
    });
    setImporting(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.error ?? "นำเข้าไม่สำเร็จ");
      return;
    }

    const summary = await res.json();
    showToast(`นำเข้าสำเร็จ: เพิ่มใหม่ ${summary.created}, เติมข้อมูล ${summary.updated}, ข้าม ${summary.skipped}`);
    setImportOpen(false);
    setImportRows(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end gap-2">
        <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileSelected} />
        <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
          <Upload className="h-4 w-4" />
          นำเข้าจาก CSV
        </Button>
        <Button variant="gold" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          เพิ่มลูกค้า
        </Button>
      </div>

      {customers.length === 0 ? (
        <p className="rounded-lg border border-dashed border-cream-200 p-8 text-center text-sm text-ink-400">
          ยังไม่มีข้อมูลลูกค้า — จะถูกบันทึกอัตโนมัติเมื่อมีการจองครั้งถัดไป หรือเพิ่ม/นำเข้าได้ที่นี่
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ชื่อ-นามสกุล</TableHead>
              <TableHead>เบอร์โทร</TableHead>
              <TableHead>เลขนิติบุคคล</TableHead>
              <TableHead className="text-right">จัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>{c.phone || "-"}</TableCell>
                <TableCell>{c.taxId || "-"}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                      <Pencil className="h-4 w-4 text-forest-700" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}>
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
            <DialogTitle>{editing ? "แก้ไขข้อมูลลูกค้า" : "เพิ่มลูกค้าใหม่"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>ชื่อ-นามสกุล</Label>
              <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>เบอร์โทร</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>เลขนิติบุคคล (ถ้ามี)</Label>
              <Input value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })} />
            </div>
            {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <Button type="submit" variant="gold" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              บันทึก
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ตรวจสอบข้อมูลก่อนนำเข้า</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <p className="text-sm text-ink-600">
              พบ {importRows?.length ?? 0} รายการ — ลูกค้าที่มีชื่อซ้ำกับรายชื่อเดิมจะเติมเฉพาะข้อมูลที่ยังว่างอยู่ ไม่ทับข้อมูลเดิม
            </p>
            <div className="max-h-64 overflow-y-auto rounded-md border border-cream-200">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ชื่อ</TableHead>
                    <TableHead>เบอร์โทร</TableHead>
                    <TableHead>เลขนิติบุคคล</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importRows?.slice(0, 50).map((r, i) => (
                    <TableRow key={i}>
                      <TableCell>{r.name}</TableCell>
                      <TableCell>{r.phone || "-"}</TableCell>
                      <TableCell>{r.taxId || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {(importRows?.length ?? 0) > 50 && (
              <p className="text-xs text-ink-400">แสดง 50 รายการแรก จากทั้งหมด {importRows?.length}</p>
            )}
            <Button type="button" variant="gold" onClick={confirmImport} disabled={importing}>
              {importing && <Loader2 className="h-4 w-4 animate-spin" />}
              ยืนยันนำเข้า
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
