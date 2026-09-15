"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { AddonEditor, type AddonFormValue } from "@/components/accommodation/AddonEditor";
import { PaymentPanel, type PaymentFormValue } from "@/components/payment/PaymentPanel";
import { SOURCE_LABELS, ACCOMMODATION_STATUS_LABELS } from "@/lib/labels";
import { toDateOnlyString } from "@/lib/dates";

type ResourceOption = { id: string; name: string; zone: string };

export type AccommodationBookingFormValue = {
  id?: string;
  resourceId: string;
  customerName: string;
  phone: string;
  source: string;
  checkIn: string;
  checkOut: string;
  guestCount: number;
  status: string;
  notes: string;
  cancelReason: string;
  addons: AddonFormValue[];
  payment: PaymentFormValue;
};

export function defaultAccommodationFormValue(
  overrides?: Partial<AccommodationBookingFormValue>
): AccommodationBookingFormValue {
  const today = toDateOnlyString(new Date());
  return {
    resourceId: "",
    customerName: "",
    phone: "",
    source: "WALK_IN",
    checkIn: today,
    checkOut: today,
    guestCount: 1,
    status: "RESERVED",
    notes: "",
    cancelReason: "",
    addons: [],
    payment: { totalAmount: 0, depositAmount: 0, status: "PAY_LATER", method: "CASH", notes: "" },
    ...overrides,
  };
}

export function AccommodationBookingForm({
  resources,
  initial,
  onSaved,
  onCancel,
}: {
  resources: ResourceOption[];
  initial: AccommodationBookingFormValue;
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const url = value.id ? `/api/accommodation-bookings/${value.id}` : "/api/accommodation-bookings";
    const method = value.id ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value),
    });

    setSaving(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "เกิดข้อผิดพลาด กรุณาลองใหม่");
      return;
    }

    router.refresh();
    onSaved?.();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label>ห้องพัก</Label>
          <Select
            required
            value={value.resourceId}
            onChange={(e) => setValue({ ...value, resourceId: e.target.value })}
          >
            <option value="">เลือกห้อง</option>
            {resources.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>ชื่อลูกค้า</Label>
          <Input
            required
            value={value.customerName}
            onChange={(e) => setValue({ ...value, customerName: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>เบอร์โทรศัพท์</Label>
          <Input
            required
            value={value.phone}
            onChange={(e) => setValue({ ...value, phone: e.target.value })}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>ช่องทางการจอง</Label>
          <Select value={value.source} onChange={(e) => setValue({ ...value, source: e.target.value })}>
            {Object.entries(SOURCE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>จำนวนผู้เข้าพัก</Label>
          <Input
            type="number"
            min={1}
            value={value.guestCount}
            onChange={(e) => setValue({ ...value, guestCount: Number(e.target.value) })}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>วันที่เช็คอิน</Label>
          <Input
            type="date"
            required
            value={value.checkIn}
            onChange={(e) => setValue({ ...value, checkIn: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>วันที่เช็คเอาท์</Label>
          <Input
            type="date"
            required
            value={value.checkOut}
            onChange={(e) => setValue({ ...value, checkOut: e.target.value })}
          />
        </div>

        <div className="col-span-2 flex flex-col gap-1.5">
          <Label>สถานะ</Label>
          <Select value={value.status} onChange={(e) => setValue({ ...value, status: e.target.value })}>
            {Object.entries(ACCOMMODATION_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </div>

        <div className="col-span-2 flex flex-col gap-1.5">
          <Label>หมายเหตุ</Label>
          <Textarea
            rows={2}
            value={value.notes}
            onChange={(e) => setValue({ ...value, notes: e.target.value })}
          />
        </div>

        {value.status === "CANCELLED" && (
          <div className="col-span-2 flex flex-col gap-1.5">
            <Label>เหตุผลที่ยกเลิก</Label>
            <Textarea
              rows={2}
              placeholder="ระบุเหตุผลการยกเลิก (ถ้ามี)"
              value={value.cancelReason}
              onChange={(e) => setValue({ ...value, cancelReason: e.target.value })}
            />
          </div>
        )}
      </div>

      <AddonEditor value={value.addons} onChange={(addons) => setValue({ ...value, addons })} />

      <PaymentPanel value={value.payment} onChange={(payment) => setValue({ ...value, payment })} />

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            ยกเลิก
          </Button>
        )}
        <Button type="submit" variant="gold" disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          บันทึกการจอง
        </Button>
      </div>
    </form>
  );
}
