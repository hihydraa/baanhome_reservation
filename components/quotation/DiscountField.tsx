"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

export type DiscountValue = {
  discountType: "BAHT" | "PERCENT";
  discountValue: number;
  discountNote: string;
};

export function DiscountField({ value, onChange }: { value: DiscountValue; onChange: (next: DiscountValue) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>ส่วนลดในใบเสนอราคา</Label>
      <div className="flex flex-wrap gap-2">
        <Input
          type="number"
          min={0}
          step="0.01"
          className="max-w-40"
          value={value.discountValue}
          onChange={(e) => onChange({ ...value, discountValue: Number(e.target.value) })}
        />
        <Select
          className="max-w-28"
          value={value.discountType}
          onChange={(e) => onChange({ ...value, discountType: e.target.value as "BAHT" | "PERCENT" })}
        >
          <option value="BAHT">บาท</option>
          <option value="PERCENT">%</option>
        </Select>
        <Input
          className="min-w-48 flex-1"
          placeholder="หมายเหตุส่วนลด เช่น ลูกค้าประจำ, โปรโมชัน"
          value={value.discountNote}
          onChange={(e) => onChange({ ...value, discountNote: e.target.value })}
        />
      </div>
    </div>
  );
}
