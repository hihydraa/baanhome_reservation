"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CustomerOption } from "@/components/customers/CustomerNameInput";

export type CustomerDetailsValue = { enabled: boolean; address: string; taxId: string };

export const EMPTY_CUSTOMER_DETAILS: CustomerDetailsValue = { enabled: false, address: "", taxId: "" };

/** Opens the section already filled in when the customer in the directory has an address or an ID number. */
export function detailsFromCustomer(c: Pick<CustomerOption, "address" | "taxId"> | undefined | null): CustomerDetailsValue {
  const address = c?.address ?? "";
  const taxId = c?.taxId ?? "";
  return { enabled: !!(address || taxId), address, taxId };
}

/** What to send with the booking: nothing unless staff ticked the box and typed something. */
export function customerDetailsPayload(v: CustomerDetailsValue): { address?: string; taxId?: string } | undefined {
  if (!v.enabled) return undefined;
  const address = v.address.trim();
  const taxId = v.taxId.trim();
  if (!address && !taxId) return undefined;
  return { ...(address ? { address } : {}), ...(taxId ? { taxId } : {}) };
}

/**
 * Optional "customer details" part of a booking form: a tick box that opens the address and the national ID /
 * juristic ID fields. What is typed is saved to the customer directory and printed on the quotation.
 */
export function CustomerDetailsSection({ value, onChange }: { value: CustomerDetailsValue; onChange: (v: CustomerDetailsValue) => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-cream-200 bg-cream-50 px-3 py-3 sm:col-span-2">
      <label className="flex items-start gap-2 text-sm text-ink-900">
        <input type="checkbox" className="mt-0.5 h-4 w-4" checked={value.enabled} onChange={(e) => onChange({ ...value, enabled: e.target.checked })} />
        <span>
          ระบุที่อยู่ / เลขประจำตัวประชาชน-เลขนิติบุคคล ของลูกค้า
          <span className="block text-xs text-ink-400">สำหรับใบเสนอราคา ระบบจะบันทึกลงฐานข้อมูลลูกค้าให้ด้วย</span>
        </span>
      </label>
      {value.enabled && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label>ที่อยู่</Label>
            <Textarea rows={2} value={value.address} onChange={(e) => onChange({ ...value, address: e.target.value })} placeholder="บ้านเลขที่ ถนน ตำบล อำเภอ จังหวัด รหัสไปรษณีย์" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>เลขประจำตัวประชาชน / เลขนิติบุคคล</Label>
            <Input value={value.taxId} inputMode="numeric" maxLength={30} onChange={(e) => onChange({ ...value, taxId: e.target.value })} placeholder="เลข 13 หลัก" />
          </div>
        </div>
      )}
    </div>
  );
}
