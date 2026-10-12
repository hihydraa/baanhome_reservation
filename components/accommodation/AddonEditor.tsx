"use client";

import { useId, useRef } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type AddonFormValue = {
  serviceId: string | null;
  description: string;
  quantity: number;
  price: number;
};

export type ServiceOption = { id: string; name: string; price: number };

const EMPTY_ADDON: AddonFormValue = { serviceId: null, description: "", quantity: 1, price: 0 };

type Column = "name" | "qty" | "price";

/** Spreadsheet-style line-item table: Enter jumps down a row (adding one from the last row), arrows move up/down. */
export function AddonEditor({
  value,
  onChange,
  services,
}: {
  value: AddonFormValue[];
  onChange: (next: AddonFormValue[]) => void;
  services: ServiceOption[];
}) {
  const tableRef = useRef<HTMLDivElement>(null);
  const listId = `addon-services-${useId()}`;

  function focusCell(row: number, col: Column) {
    // Wait a frame so a freshly-added row has rendered.
    requestAnimationFrame(() => {
      tableRef.current?.querySelector<HTMLInputElement>(`[data-cell="${row}-${col}"]`)?.focus();
    });
  }

  function update(index: number, patch: Partial<AddonFormValue>) {
    onChange(value.map((a, i) => (i === index ? { ...a, ...patch } : a)));
  }

  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function addRow() {
    onChange([...value, { ...EMPTY_ADDON }]);
    focusCell(value.length, "name");
  }

  /** Typing a name that exactly matches a catalogue service links it and fills its price; any other text is a custom item. */
  function handleNameChange(index: number, text: string) {
    const service = services.find((s) => s.name === text);
    if (service && value[index].serviceId !== service.id) {
      update(index, { serviceId: service.id, description: service.name, price: service.price });
    } else if (!service) {
      update(index, { serviceId: null, description: text });
    } else {
      update(index, { description: text });
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>, row: number, col: Column) {
    if (e.key === "Enter" || e.key === "ArrowDown") {
      e.preventDefault();
      if (row === value.length - 1) {
        if (e.key === "Enter") {
          addRow();
        }
      } else {
        focusCell(row + 1, col);
      }
    } else if (e.key === "ArrowUp" && row > 0) {
      e.preventDefault();
      focusCell(row - 1, col);
    }
  }

  const total = value.reduce((sum, a) => sum + a.quantity * a.price, 0);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-cream-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-forest-800">บริการเพิ่มเติม</p>
        <Button type="button" variant="subtle" size="sm" onClick={addRow}>
          <Plus className="h-3.5 w-3.5" />
          เพิ่มแถว
        </Button>
      </div>

      <datalist id={listId}>
        {services.map((s) => (
          <option key={s.id} value={s.name}>
            {s.price.toLocaleString("th-TH")} บาท
          </option>
        ))}
      </datalist>

      {value.length === 0 ? (
        <p className="text-xs text-ink-400">ไม่มีบริการเพิ่มเติม</p>
      ) : (
        <div ref={tableRef} className="flex flex-col gap-1.5 overflow-x-auto">
          <div className="grid min-w-[30rem] grid-cols-[1fr_4.5rem_6.5rem_6rem_2rem] gap-1.5 px-0.5 text-xs text-ink-400">
            <span>รายการ (พิมพ์ค้นหาบริการ หรือระบุเอง)</span>
            <span>จำนวน</span>
            <span>ราคา/หน่วย</span>
            <span className="text-right">รวม</span>
            <span />
          </div>
          {value.map((addon, i) => (
            <div key={i} className="grid min-w-[30rem] grid-cols-[1fr_4.5rem_6.5rem_6rem_2rem] items-center gap-1.5">
              <Input
                data-cell={`${i}-name`}
                list={listId}
                placeholder="ชื่อรายการ"
                value={addon.description}
                onChange={(e) => handleNameChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, i, "name")}
              />
              <Input
                data-cell={`${i}-qty`}
                type="number"
                min={1}
                value={addon.quantity}
                onChange={(e) => update(i, { quantity: Math.max(1, Number(e.target.value)) })}
                onKeyDown={(e) => handleKeyDown(e, i, "qty")}
              />
              <Input
                data-cell={`${i}-price`}
                type="number"
                min={0}
                value={addon.price}
                onChange={(e) => update(i, { price: Number(e.target.value) })}
                onKeyDown={(e) => handleKeyDown(e, i, "price")}
              />
              <div className="text-right text-sm font-medium text-forest-800">
                {(addon.quantity * addon.price).toLocaleString("th-TH")}
              </div>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => remove(i)}>
                <Trash2 className="h-4 w-4 text-red-600" />
              </Button>
            </div>
          ))}
          <div className="grid min-w-[30rem] grid-cols-[1fr_4.5rem_6.5rem_6rem_2rem] gap-1.5 border-t border-cream-200 pt-1.5 text-sm font-semibold text-forest-800">
            <span className="col-span-3 text-right">รวมบริการเพิ่มเติม</span>
            <span className="text-right">{total.toLocaleString("th-TH")}</span>
            <span />
          </div>
        </div>
      )}
    </div>
  );
}
