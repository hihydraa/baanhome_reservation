"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, XCircle } from "lucide-react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PaymentStatusPill } from "@/components/payment/PaymentStatusPill";
import { useToast } from "@/components/ui/toast-provider";

export type BookingListRow = {
  id: string;
  roomName: string;
  customerName: string;
  phone: string;
  checkIn: string;
  checkOut: string;
  status: "RESERVED" | "CHECKED_IN" | "CHECKED_OUT" | "CANCELLED";
  statusLabel: string;
  paid: number;
  expectedTotal: number;
  charterGroupId: string | null;
};

const STATUS_VARIANT: Record<string, "success" | "gold" | "muted" | "danger"> = {
  CHECKED_IN: "success",
  RESERVED: "gold",
  CHECKED_OUT: "muted",
  CANCELLED: "danger",
};

/** The bookings list. Staff can tick several rooms (or a whole charter) and cancel them together with one reason. */
export function BookingListTable({ rows, canCancel }: { rows: BookingListRow[]; canCancel: boolean }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectable = useMemo(() => rows.filter((r) => r.status !== "CANCELLED"), [rows]);
  const groupSizes = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of selectable) if (r.charterGroupId) m.set(r.charterGroupId, (m.get(r.charterGroupId) ?? 0) + 1);
    return m;
  }, [selectable]);
  const chosen = selectable.filter((r) => selected.has(r.id));
  const chosenPaid = chosen.reduce((s, r) => s + r.paid, 0);
  const allSelected = selectable.length > 0 && chosen.length === selectable.length;

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectGroup(groupId: string) {
    setSelected((s) => {
      const next = new Set(s);
      for (const r of selectable) if (r.charterGroupId === groupId) next.add(r.id);
      return next;
    });
  }

  async function cancelSelected(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/accommodation-bookings/bulk-cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: chosen.map((r) => r.id), reason }),
    });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? `ยกเลิกไม่สำเร็จ (${res.status})`);
      return;
    }
    const body = await res.json();
    setOpen(false);
    setSelected(new Set());
    setReason("");
    showToast(`ยกเลิกแล้ว ${body.cancelled} ห้อง — บันทึกไว้ในประวัติการยกเลิก/ลบ`);
    router.refresh();
  }

  if (rows.length === 0) {
    return <p className="rounded-lg border border-dashed border-cream-200 p-8 text-center text-sm text-ink-400">ไม่มีการจอง</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {canCancel && chosen.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2">
          <span className="text-sm text-red-800">เลือกไว้ {chosen.length} ห้อง</span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setSelected(new Set())}>
              ล้างที่เลือก
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => {
                setReason("");
                setError(null);
                setOpen(true);
              }}
            >
              <XCircle className="h-4 w-4" />
              ยกเลิกที่เลือก
            </Button>
          </div>
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            {canCancel && (
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  aria-label="เลือกทั้งหมด"
                  className="h-4 w-4"
                  checked={allSelected}
                  onChange={() => setSelected(allSelected ? new Set() : new Set(selectable.map((r) => r.id)))}
                />
              </TableHead>
            )}
            <TableHead>ห้อง</TableHead>
            <TableHead>ลูกค้า</TableHead>
            <TableHead>เช็คอิน</TableHead>
            <TableHead>เช็คเอาท์</TableHead>
            <TableHead>สถานะ</TableHead>
            <TableHead>การชำระเงิน</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              {canCancel && (
                <TableCell>
                  {r.status !== "CANCELLED" && (
                    <input
                      type="checkbox"
                      aria-label={`เลือก ${r.roomName}`}
                      className="h-4 w-4"
                      checked={selected.has(r.id)}
                      onChange={() => toggle(r.id)}
                    />
                  )}
                </TableCell>
              )}
              <TableCell className="font-medium">
                <Link href={`/accommodation/${r.id}`} className="text-forest-700 hover:underline">
                  {r.roomName}
                </Link>
                {canCancel && r.status !== "CANCELLED" && r.charterGroupId && (groupSizes.get(r.charterGroupId) ?? 0) > 1 && (
                  <button
                    type="button"
                    className="mt-0.5 block text-xs font-normal text-violet-700 hover:underline"
                    onClick={() => selectGroup(r.charterGroupId!)}
                  >
                    เลือกทั้งกลุ่มเหมา ({groupSizes.get(r.charterGroupId)} ห้อง)
                  </button>
                )}
              </TableCell>
              <TableCell>
                <div>{r.customerName}</div>
                <div className="text-xs text-ink-400">{r.phone}</div>
              </TableCell>
              <TableCell>{r.checkIn}</TableCell>
              <TableCell>{r.checkOut}</TableCell>
              <TableCell>
                <Badge variant={STATUS_VARIANT[r.status]}>{r.statusLabel}</Badge>
              </TableCell>
              <TableCell>
                {r.status === "CANCELLED" ? (
                  <span className="text-ink-400">—</span>
                ) : (
                  <PaymentStatusPill paid={r.paid} expectedTotal={r.expectedTotal} />
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ยกเลิกการจอง {chosen.length} ห้อง</DialogTitle>
          </DialogHeader>
          <form onSubmit={cancelSelected} className="flex flex-col gap-3">
            <ul className="max-h-40 overflow-y-auto rounded-md border border-cream-200 px-3 py-2 text-sm text-ink-700">
              {chosen.map((r) => (
                <li key={r.id}>
                  {r.roomName} — {r.customerName} ({r.checkIn} – {r.checkOut})
                </li>
              ))}
            </ul>
            {chosenPaid > 0 && (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
                ห้องที่เลือกมีเงินที่รับไว้แล้วรวม {chosenPaid.toLocaleString("th-TH")} บาท เงินส่วนนี้จะไปแสดงในรายงาน
                &quot;เงินที่รับไว้จากการจองที่ยกเลิก&quot; เพื่อพิจารณาคืนเงิน
              </p>
            )}
            <div className="flex flex-col gap-1.5">
              <Label>
                เหตุผลที่ยกเลิก <span className="text-red-600">*</span>
              </Label>
              <Textarea
                rows={3}
                required
                minLength={3}
                placeholder="เช่น ลูกค้าเลื่อนกำหนดการเดินทาง"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <DialogFooter>
              <Button type="submit" variant="destructive" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                ยืนยันยกเลิก {chosen.length} ห้อง
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
