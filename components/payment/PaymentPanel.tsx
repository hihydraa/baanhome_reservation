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

export type PaymentReferenceItem = { label: string; value: string };

export function PaymentPanel({
  value,
  onChange,
  referenceItems,
}: {
  value: PaymentFormValue;
  onChange: (next: PaymentFormValue) => void;
  /** Reference prices pulled from elsewhere (e.g. the room rate sheet) — shown read-only for staff to check against. */
  referenceItems?: PaymentReferenceItem[];
}) {
  const netTotal = value.depositAmount + value.totalAmount;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-cream-200 bg-white p-4">
      <p className="text-sm font-semibold text-forest-800">การชำระเงิน</p>

      {referenceItems && referenceItems.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-md bg-gold-100 px-3 py-2 text-sm">
          {referenceItems.map((item) => (
            <span key={item.label}>
              <span className="text-ink-600">{item.label}: </span>
              <span className="font-semibold text-forest-800">{item.value}</span>
            </span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label>มัดจำ (บาท)</Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={value.depositAmount === 0 ? "" : value.depositAmount}
            onChange={(e) => onChange({ ...value, depositAmount: e.target.value === "" ? 0 : Number(e.target.value) })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>จ่ายแล้ว (บาท)</Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={value.totalAmount === 0 ? "" : value.totalAmount}
            onChange={(e) => onChange({ ...value, totalAmount: e.target.value === "" ? 0 : Number(e.target.value) })}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 rounded-md bg-cream-100 px-3 py-2.5 text-sm">
        <span className="text-ink-600">มัดจำ</span>
        <span className="font-semibold text-forest-800">{value.depositAmount.toLocaleString("th-TH")}</span>
        <span className="text-ink-400">+</span>
        <span className="text-ink-600">จ่ายแล้ว</span>
        <span className="font-semibold text-forest-800">{value.totalAmount.toLocaleString("th-TH")}</span>
        <span className="text-ink-400">=</span>
        <span className="text-ink-600">รวมจ่ายสุทธิ</span>
        <span className="font-semibold text-forest-800">{netTotal.toLocaleString("th-TH")}</span>
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
