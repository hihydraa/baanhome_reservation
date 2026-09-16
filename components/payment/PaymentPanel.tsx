"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/labels";

export type PaymentFormValue = {
  totalAmount: number;
  depositAmount: number;
  status: "PAID" | "DEPOSIT" | "PAY_LATER";
  method: "CASH" | "TRANSFER";
  notes: string;
};

export function PaymentPanel({
  value,
  onChange,
}: {
  value: PaymentFormValue;
  onChange: (next: PaymentFormValue) => void;
}) {
  const balance = Math.max(0, value.totalAmount - value.depositAmount);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-cream-200 bg-white p-4">
      <p className="text-sm font-semibold text-forest-800">การชำระเงิน</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label>ยอดมัดจำ (บาท)</Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={value.depositAmount}
            onChange={(e) => onChange({ ...value, depositAmount: Number(e.target.value) })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>ยอดรวมทั้งหมด (บาท)</Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={value.totalAmount}
            onChange={(e) => onChange({ ...value, totalAmount: Number(e.target.value) })}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 rounded-md bg-cream-100 px-3 py-2.5 text-sm">
        <span className="text-ink-600">มัดจำ</span>
        <span className="font-semibold text-forest-800">{value.depositAmount.toLocaleString("th-TH")}</span>
        <span className="text-ink-400">+</span>
        <span className="text-ink-600">จ่ายเพิ่ม</span>
        <span className="font-semibold text-forest-800">{balance.toLocaleString("th-TH")}</span>
        <span className="text-ink-400">=</span>
        <span className="text-ink-600">จ่ายรวม</span>
        <span className="font-semibold text-forest-800">{value.totalAmount.toLocaleString("th-TH")}</span>
        <span className="text-ink-600">บาท</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label>สถานะการชำระเงิน</Label>
          <Select
            value={value.status}
            onChange={(e) => onChange({ ...value, status: e.target.value as PaymentFormValue["status"] })}
          >
            {Object.entries(PAYMENT_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>วิธีชำระเงิน</Label>
          <Select
            value={value.method}
            onChange={(e) => onChange({ ...value, method: e.target.value as PaymentFormValue["method"] })}
          >
            {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </div>
      </div>
    </div>
  );
}
