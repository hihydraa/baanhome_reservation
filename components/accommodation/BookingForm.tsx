"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { AddonEditor, type AddonFormValue, type ServiceOption } from "@/components/accommodation/AddonEditor";
import {
  InitialDepositInput,
  DEFAULT_INITIAL_DEPOSIT,
  type InitialDepositValue,
} from "@/components/payment/InitialDepositInput";
import { PaymentLedger, type PaymentEntryValue, type StaffOption } from "@/components/payment/PaymentLedger";
import { useToast } from "@/components/ui/toast-provider";
import { SOURCE_LABELS, ACCOMMODATION_STATUS_LABELS } from "@/lib/labels";
import { toDateOnlyString } from "@/lib/dates";

type ResourceOption = { id: string; name: string; zone: string; price: number | null };

export type AccommodationBookingFormValue = {
  id?: string;
  resourceId: string;
  customerName: string;
  phone: string;
  source: string;
  checkIn: string;
  checkOut: string;
  guestCount: number;
  roomPrice: number;
  status: string;
  notes: string;
  cancelReason: string;
  addons: AddonFormValue[];
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
    roomPrice: 0,
    status: "RESERVED",
    notes: "",
    cancelReason: "",
    addons: [],
    ...overrides,
  };
}

export type AccommodationPaymentLedgerProps = {
  paymentId: string;
  breakdown: { label: string; value: number }[];
  expectedTotal: number;
  entries: PaymentEntryValue[];
  staffOptions: StaffOption[];
  currentUserId: string;
};

export function AccommodationBookingForm({
  resources,
  services,
  initial,
  ledger,
  onSaved,
  onCancel,
}: {
  resources: ResourceOption[];
  services: ServiceOption[];
  initial: AccommodationBookingFormValue;
  /** Only present when editing an already-saved booking — a new booking has nowhere to attach entries to yet. */
  ledger?: AccommodationPaymentLedgerProps;
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const { showToast } = useToast();

  function priceForResource(resourceId: string): number | null {
    return resources.find((r) => r.id === resourceId)?.price ?? null;
  }

  const [value, setValue] = useState(() => {
    // Only guess a starting price for a brand-new booking pre-filled with a room (e.g. from the
    // dashboard's "จองห้องนี้" link) — never overwrite an existing booking's saved price on load.
    if (!initial.id && initial.resourceId && !initial.roomPrice && initial.source !== "AGODA") {
      const price = priceForResource(initial.resourceId);
      if (price != null) return { ...initial, roomPrice: price };
    }
    return initial;
  });
  const [initialDeposit, setInitialDeposit] = useState<InitialDepositValue>(DEFAULT_INITIAL_DEPOSIT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleResourceChange(resourceId: string) {
    if (value.source === "AGODA") {
      setValue({ ...value, resourceId });
      return;
    }
    const price = priceForResource(resourceId);
    setValue({ ...value, resourceId, roomPrice: price ?? value.roomPrice });
  }

  function handleSourceChange(source: string) {
    if (source === "AGODA") {
      setValue({ ...value, source, roomPrice: 0 });
      return;
    }
    const price = priceForResource(value.resourceId);
    setValue({ ...value, source, roomPrice: price ?? value.roomPrice });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const url = value.id ? `/api/accommodation-bookings/${value.id}` : "/api/accommodation-bookings";
    const method = value.id ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value.id ? value : { ...value, initialPayment: initialDeposit }),
    });

    setSaving(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "เกิดข้อผิดพลาด กรุณาลองใหม่");
      return;
    }

    showToast(value.id ? "บันทึกการจองห้องพักสำเร็จ" : "จองห้องพักสำเร็จ");
    router.refresh();
    onSaved?.();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label>ห้องพัก</Label>
          <Select required value={value.resourceId} onChange={(e) => handleResourceChange(e.target.value)}>
            <option value="">เลือกห้อง</option>
            {resources.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>ราคาห้องพัก (บาท/คืน){value.source === "AGODA" && <span className="text-ink-400"> — กรอกเอง</span>}</Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={value.roomPrice === 0 ? "" : value.roomPrice}
            onChange={(e) => setValue({ ...value, roomPrice: e.target.value === "" ? 0 : Number(e.target.value) })}
          />
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
          <Select value={value.source} onChange={(e) => handleSourceChange(e.target.value)}>
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

      <AddonEditor value={value.addons} onChange={(addons) => setValue({ ...value, addons })} services={services} />

      {!value.id && <InitialDepositInput value={initialDeposit} onChange={setInitialDeposit} />}

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

      {ledger && (
        <PaymentLedger
          paymentId={ledger.paymentId}
          breakdown={ledger.breakdown}
          expectedTotal={ledger.expectedTotal}
          entries={ledger.entries}
          staffOptions={ledger.staffOptions}
          currentUserId={ledger.currentUserId}
        />
      )}
    </form>
  );
}
