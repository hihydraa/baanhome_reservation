"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast-provider";

type Row = { id: string; name: string; price: number | null };

function PriceRow({ row }: { row: Row }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [value, setValue] = useState(row.price ?? 0);
  const [saving, setSaving] = useState(false);
  const dirty = value !== (row.price ?? 0);

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/resources/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ price: value }),
    });
    setSaving(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.error ?? "บันทึกไม่สำเร็จ");
      return;
    }

    showToast(`บันทึกราคา "${row.name}" แล้ว`);
    router.refresh();
  }

  return (
    <TableRow>
      <TableCell className="font-medium">{row.name}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            step="0.01"
            className="w-32"
            value={value === 0 ? "" : value}
            onChange={(e) => setValue(e.target.value === "" ? 0 : Number(e.target.value))}
          />
          {dirty && (
            <Button type="button" variant="gold" size="icon" onClick={save} disabled={saving} aria-label="บันทึก">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            </Button>
          )}
        </div>
      </TableCell>
      <TableCell className="text-ink-400">ระบุเอง</TableCell>
    </TableRow>
  );
}

export function AccommodationPriceTable({ rows }: { rows: Row[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>ห้อง</TableHead>
          <TableHead>ราคาห้องพัก (บาท/คืน)</TableHead>
          <TableHead>Agoda</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <PriceRow key={r.id} row={r} />
        ))}
      </TableBody>
    </Table>
  );
}
