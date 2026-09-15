"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ADDON_TYPE_LABELS } from "@/lib/labels";

export type AddonFormValue = {
  type: "EXTRA_BED" | "PET" | "BORROWED_ITEM";
  description: string;
  quantity: number;
  price: number;
};

const EMPTY_ADDON: AddonFormValue = { type: "EXTRA_BED", description: "", quantity: 1, price: 0 };

export function AddonEditor({
  value,
  onChange,
}: {
  value: AddonFormValue[];
  onChange: (next: AddonFormValue[]) => void;
}) {
  function update(index: number, patch: Partial<AddonFormValue>) {
    onChange(value.map((a, i) => (i === index ? { ...a, ...patch } : a)));
  }

  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-cream-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-forest-800">บริการเพิ่มเติม</p>
        <Button
          type="button"
          variant="subtle"
          size="sm"
          onClick={() => onChange([...value, { ...EMPTY_ADDON }])}
        >
          <Plus className="h-3.5 w-3.5" />
          เพิ่มรายการ
        </Button>
      </div>

      {value.length === 0 && <p className="text-xs text-ink-400">ไม่มีบริการเพิ่มเติม</p>}

      {value.map((addon, i) => (
        <div key={i} className="grid grid-cols-[1fr_1.4fr_70px_90px_32px] items-end gap-2">
          <Select value={addon.type} onChange={(e) => update(i, { type: e.target.value as AddonFormValue["type"] })}>
            {Object.entries(ADDON_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
          <Input
            placeholder="รายละเอียด"
            value={addon.description}
            onChange={(e) => update(i, { description: e.target.value })}
          />
          <Input
            type="number"
            min={1}
            placeholder="จำนวน"
            value={addon.quantity}
            onChange={(e) => update(i, { quantity: Number(e.target.value) })}
          />
          <Input
            type="number"
            min={0}
            placeholder="ราคา"
            value={addon.price}
            onChange={(e) => update(i, { price: Number(e.target.value) })}
          />
          <Button type="button" variant="ghost" size="icon" onClick={() => remove(i)}>
            <Trash2 className="h-4 w-4 text-red-600" />
          </Button>
        </div>
      ))}
    </div>
  );
}
