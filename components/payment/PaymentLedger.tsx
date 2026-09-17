"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Trash2, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast-provider";
import { PAYMENT_METHOD_LABELS } from "@/lib/labels";
import { formatThaiDate, formatTime, toDateOnlyString } from "@/lib/dates";
import { sumPaid } from "@/lib/payment-calc";
import { PaymentStatusPill } from "@/components/payment/PaymentStatusPill";

export type PaymentMethodValue = "CASH" | "TRANSFER" | "CREDIT_CARD";

export type PaymentEntryValue = {
  id: string;
  amount: number;
  method: PaymentMethodValue;
  paidAt: string;
  receivedBy: { id: string; name: string } | null;
  notes: string | null;
  receiptNumber: string;
};

export type StaffOption = { id: string; name: string };

type FormState = { amount: string; method: PaymentMethodValue; paidAt: string; receivedById: string; notes: string };

function entryToFormState(entry: PaymentEntryValue): FormState {
  return {
    amount: String(entry.amount),
    method: entry.method,
    paidAt: toDateOnlyString(new Date(entry.paidAt)),
    receivedById: entry.receivedBy?.id ?? "",
    notes: entry.notes ?? "",
  };
}

function emptyFormState(defaultReceivedById: string): FormState {
  return { amount: "", method: "CASH", paidAt: toDateOnlyString(new Date()), receivedById: defaultReceivedById, notes: "" };
}

export function PaymentLedger({
  paymentId,
  breakdown,
  expectedTotal,
  entries,
  staffOptions,
  currentUserId,
}: {
  paymentId: string;
  breakdown: { label: string; value: number }[];
  expectedTotal: number;
  entries: PaymentEntryValue[];
  staffOptions: StaffOption[];
  currentUserId: string;
}) {
  const router = useRouter();
  const { showToast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<PaymentEntryValue | null>(null);
  const [form, setForm] = useState<FormState>(() => emptyFormState(currentUserId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  const paid = sumPaid(entries);
  const remaining = Math.max(0, expectedTotal - paid);

  function openCreateDialog() {
    setEditingEntry(null);
    setForm(emptyFormState(currentUserId));
    setError(null);
    setDialogOpen(true);
  }

  function openEditDialog(entry: PaymentEntryValue) {
    setEditingEntry(entry);
    setForm(entryToFormState(entry));
    setError(null);
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const url = editingEntry ? `/api/payments/entries/${editingEntry.id}` : `/api/payments/${paymentId}/entries`;
    const method = editingEntry ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: form.amount === "" ? 0 : Number(form.amount),
        method: form.method,
        paidAt: form.paidAt,
        receivedById: form.receivedById || null,
        notes: form.notes,
      }),
    });

    setSaving(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "เกิดข้อผิดพลาด กรุณาลองใหม่");
      return;
    }

    setDialogOpen(false);
    showToast(editingEntry ? "แก้ไขรายการชำระเงินสำเร็จ" : "บันทึกการรับชำระเงินสำเร็จ");
    router.refresh();
  }

  async function handleDelete(entryId: string) {
    if (confirmingDeleteId !== entryId) {
      setConfirmingDeleteId(entryId);
      return;
    }
    setConfirmingDeleteId(null);
    const res = await fetch(`/api/payments/entries/${entryId}`, { method: "DELETE" });
    if (res.ok) {
      showToast("ลบรายการชำระเงินแล้ว");
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-lg border border-cream-200 bg-white p-4">
        <p className="text-sm font-semibold text-forest-800">สรุปยอดการจอง</p>
        <div className="flex flex-col gap-1.5 text-sm">
          {breakdown.map((line) => (
            <div key={line.label} className="flex items-center justify-between">
              <span className="text-ink-600">{line.label}</span>
              <span className="font-medium text-ink-900">{line.value.toLocaleString("th-TH")} บาท</span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between rounded-md bg-gold-100 px-3 py-2.5">
          <span className="text-sm font-semibold text-forest-800">ยอดรวมสุทธิ</span>
          <span className="text-base font-bold text-forest-800">{expectedTotal.toLocaleString("th-TH")} บาท</span>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-cream-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-forest-800">สถานะการชำระเงิน</p>
          <PaymentStatusPill paid={paid} expectedTotal={expectedTotal} />
        </div>
        <div className="flex flex-col gap-1.5 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-ink-600">ยอดรวมสุทธิ</span>
            <span className="font-medium text-ink-900">{expectedTotal.toLocaleString("th-TH")} บาท</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-ink-600">ชำระแล้ว</span>
            <span className="font-medium text-ink-900">{paid.toLocaleString("th-TH")} บาท</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-ink-600">คงเหลือ</span>
            <span className="font-medium text-ink-900">{remaining.toLocaleString("th-TH")} บาท</span>
          </div>
        </div>
        {remaining > 0 && (
          <div className="flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
            <ReceiptText className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">ยังมียอดคงเหลือ {remaining.toLocaleString("th-TH")} บาท</p>
              <p className="text-xs text-amber-700">กรุณาชำระก่อนเช็คอิน หรือภายในวันที่เข้าพัก</p>
            </div>
          </div>
        )}
        <Button type="button" variant="gold" onClick={openCreateDialog} className="self-start">
          รับชำระเงิน
        </Button>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-cream-200 bg-white p-4">
        <p className="text-sm font-semibold text-forest-800">ประวัติการชำระเงิน</p>
        {entries.length === 0 ? (
          <p className="rounded-md border border-dashed border-cream-200 p-6 text-center text-sm text-ink-400">
            ยังไม่มีการชำระเงิน
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>วันที่/เวลา</TableHead>
                    <TableHead>รายการ</TableHead>
                    <TableHead>จำนวนเงิน (บาท)</TableHead>
                    <TableHead>วิธีชำระ</TableHead>
                    <TableHead>ผู้รับชำระ</TableHead>
                    <TableHead>เลขที่ใบเสร็จ</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => {
                    const paidAtDate = new Date(entry.paidAt);
                    return (
                      <TableRow key={entry.id}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {formatThaiDate(paidAtDate)} {formatTime(paidAtDate)}
                        </TableCell>
                        <TableCell className="text-sm">{entry.notes || "—"}</TableCell>
                        <TableCell className="text-sm font-medium">{entry.amount.toLocaleString("th-TH")}</TableCell>
                        <TableCell className="text-sm">{PAYMENT_METHOD_LABELS[entry.method]}</TableCell>
                        <TableCell className="text-sm">{entry.receivedBy?.name ?? "—"}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-ink-400">{entry.receiptNumber}</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => openEditDialog(entry)}
                              className="rounded p-1 text-ink-400 hover:bg-cream-100 hover:text-forest-700"
                              title="แก้ไข"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(entry.id)}
                              className={
                                confirmingDeleteId === entry.id
                                  ? "rounded px-1.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                                  : "rounded p-1 text-ink-400 hover:bg-cream-100 hover:text-red-600"
                              }
                              title="ลบ"
                            >
                              {confirmingDeleteId === entry.id ? "ยืนยันลบ" : <Trash2 className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center justify-between border-t border-cream-100 pt-2 text-sm font-semibold text-forest-800">
              <span>รวมชำระแล้วทั้งหมด</span>
              <span>{paid.toLocaleString("th-TH")} บาท</span>
            </div>
          </>
        )}
        <div className="rounded-md bg-cream-100 px-3 py-2 text-xs text-ink-500">
          <p>สามารถรับชำระเงินได้หลายครั้ง (มัดจำ / ชำระเพิ่ม / ชำระคืนเต็มจำนวน)</p>
          <p>ยอดสถานะและยอดคงเหลือจะคำนวณจากทุกครั้งที่รับชำระ</p>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingEntry ? "แก้ไขรายการชำระเงิน" : "รับชำระเงิน"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>จำนวนเงินที่รับชำระ (บาท)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  required
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>วิธีชำระเงิน</Label>
                <Select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value as PaymentMethodValue })}>
                  {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>วันที่รับชำระ</Label>
                <Input
                  type="date"
                  required
                  value={form.paidAt}
                  onChange={(e) => setForm({ ...form, paidAt: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>ผู้รับชำระ</Label>
                <Select value={form.receivedById} onChange={(e) => setForm({ ...form, receivedById: e.target.value })}>
                  <option value="">เลือกพนักงาน</option>
                  {staffOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="col-span-2 flex flex-col gap-1.5">
                <Label>หมายเหตุ (ถ้ามี)</Label>
                <Textarea
                  rows={2}
                  placeholder="เช่น มัดจำการจอง, ชำระค่าบริการเสริม (อาหารเย็น)"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
            </div>

            {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

            <DialogFooter>
              <Button type="submit" variant="gold" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingEntry ? "บันทึกการแก้ไข" : "บันทึกการรับชำระ"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
