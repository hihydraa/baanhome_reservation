"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { PAYMENT_METHOD_LABELS } from "@/lib/labels";

export type InitialDepositValue = {
  amount: number;
  method: "CASH" | "TRANSFER" | "CREDIT_CARD";
  notes: string;
};

export const DEFAULT_INITIAL_DEPOSIT: InitialDepositValue = { amount: 0, method: "CASH", notes: "" };

/** Optional first deposit at booking-creation time. Anything after this is recorded through the
 *  full payment ledger on the booking's detail page once it exists. */
export function InitialDepositInput({
  value,
  onChange,
}: {
  value: InitialDepositValue;
  onChange: (next: InitialDepositValue) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-cream-200 bg-white p-4">
      <p className="text-sm font-semibold text-forest-800">มัดจำแรกเข้า (ถ้ามี)</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label>จำนวนเงิน (บาท)</Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={value.amount === 0 ? "" : value.amount}
            onChange={(e) => onChange({ ...value, amount: e.target.value === "" ? 0 : Number(e.target.value) })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>วิธีชำระเงิน</Label>
          <Select value={value.method} onChange={(e) => onChange({ ...value, method: e.target.value as InitialDepositValue["method"] })}>
            {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <p className="text-xs text-ink-400">การชำระเงินครั้งถัดไปให้บันทึกที่หน้ารายละเอียดการจองหลังบันทึกแล้ว</p>
    </div>
  );
}
