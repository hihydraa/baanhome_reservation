"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type CustomerOption = { id: string; name: string; phone: string | null; taxId: string | null };

export function CustomerNameInput({
  value,
  onChange,
  onSelectCustomer,
  customers,
  required,
}: {
  value: string;
  onChange: (value: string) => void;
  onSelectCustomer?: (customer: CustomerOption) => void;
  customers: CustomerOption[];
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const matches = useMemo(() => {
    const query = value.trim().toLowerCase();
    if (!query) return [];
    return customers.filter((c) => c.name.toLowerCase().includes(query)).slice(0, 8);
  }, [value, customers]);

  return (
    <div className="relative">
      <Input
        required={required}
        value={value}
        autoComplete="off"
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="พิมพ์เพื่อค้นหาลูกค้าเดิม หรือกรอกชื่อใหม่"
      />
      {open && matches.length > 0 && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-cream-200 bg-white shadow-md">
          {matches.map((c) => (
            <button
              key={c.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(c.name);
                onSelectCustomer?.(c);
                setOpen(false);
              }}
              className={cn(
                "flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-cream-100"
              )}
            >
              <span className="font-medium text-ink-900">{c.name}</span>
              {c.phone && <span className="text-xs text-ink-400">{c.phone}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
