"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

export type AddonFormValue = {
  serviceId: string | null;
  description: string;
  quantity: number;
  price: number;
};

export type ServiceOption = { id: string; name: string; price: number };

const CUSTOM_VALUE = "__custom__";

const EMPTY_ADDON: AddonFormValue = { serviceId: null, description: "", quantity: 1, price: 0 };

export function AddonEditor({
  value,
  onChange,
  services,
}: {
  value: AddonFormValue[];
  onChange: (next: AddonFormValue[]) => void;
  services: ServiceOption[];
}) {
  function update(index: number, patch: Partial<AddonFormValue>) {
    onChange(value.map((a, i) => (i === index ? { ...a, ...patch } : a)));
  }

  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function handleServiceChange(index: number, selected: string) {
    if (selected === CUSTOM_VALUE) {
      update(index, { serviceId: null });
      return;
    }
    const service = services.find((s) => s.id === selected);
    update(index, {
      serviceId: selected,
      price: service?.price ?? 0,
      description: service?.name ?? "",
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-cream-200 bg-white p-4">
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

      {value.map((addon, i) => {
        const subtotal = addon.quantity * addon.price;
        return (
          <div key={i} className="flex flex-col gap-2 rounded-md border border-cream-200 p-3">
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <Label className="text-xs text-ink-400">บริการ</Label>
                <Select
                  value={addon.serviceId ?? CUSTOM_VALUE}
                  onChange={(e) => handleServiceChange(i, e.target.value)}
                >
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} — {s.price.toLocaleString("th-TH")} บาท
                    </option>
                  ))}
                  <option value={CUSTOM_VALUE}>อื่น ๆ (ระบุเอง)</option>
                </Select>
              </div>
              <Button type="button" variant="ghost" size="icon" className="mt-5" onClick={() => remove(i)}>
                <Trash2 className="h-4 w-4 text-red-600" />
              </Button>
            </div>

            {!addon.serviceId && (
              <div>
                <Label className="text-xs text-ink-400">รายละเอียด</Label>
                <Input
                  placeholder="ระบุรายละเอียดบริการ"
                  value={addon.description}
                  onChange={(e) => update(i, { description: e.target.value })}
                />
              </div>
            )}

            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs text-ink-400">จำนวน</Label>
                <Input
                  type="number"
                  min={1}
                  value={addon.quantity}
                  onChange={(e) => update(i, { quantity: Math.max(1, Number(e.target.value)) })}
                />
              </div>
              <div>
                <Label className="text-xs text-ink-400">ราคา/หน่วย</Label>
                <Input
                  type="number"
                  min={0}
                  value={addon.price}
                  onChange={(e) => update(i, { price: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label className="text-xs text-ink-400">รวม</Label>
                <div className="flex h-10 items-center rounded-md bg-cream-100 px-3 text-sm font-medium text-forest-800">
                  {subtotal.toLocaleString("th-TH")}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
