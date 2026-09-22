"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, FileText } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  InitialDepositInput,
  DEFAULT_INITIAL_DEPOSIT,
  type InitialDepositValue,
} from "@/components/payment/InitialDepositInput";
import { PaymentLedger, type PaymentEntryValue, type StaffOption } from "@/components/payment/PaymentLedger";
import { AddonEditor, type AddonFormValue, type ServiceOption } from "@/components/accommodation/AddonEditor";
import { CustomerNameInput, type CustomerOption } from "@/components/customers/CustomerNameInput";
import { ConflictBanner } from "@/components/banquet/ConflictBanner";
import { useToast } from "@/components/ui/toast-provider";
import { BANQUET_EVENT_TYPE_LABELS, BANQUET_STATUS_LABELS } from "@/lib/labels";
import { toDateOnlyString } from "@/lib/dates";
import { cn } from "@/lib/utils";

type ResourceOption = { id: string; name: string; hourlyPrice: number | null; dailyPrice: number | null };
type AccommodationOption = { id: string; label: string };

const TIME_SLOT_PRESETS = [
  { label: "ครึ่งวันเช้า (09:00-12:00)", startTime: "09:00", endTime: "12:00" },
  { label: "ครึ่งวันบ่าย (13:00-22:00)", startTime: "13:00", endTime: "22:00" },
  { label: "ทั้งวัน (09:00-22:00)", startTime: "09:00", endTime: "22:00" },
];

export type BanquetFormValue = {
  id?: string;
  resourceId: string;
  customerName: string;
  phone: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  eventType: string;
  headcount: number;
  linkedAccommodationIds: string[];
  status: string;
  notes: string;
  cancelReason: string;
  addons: AddonFormValue[];
};

export function defaultBanquetFormValue(overrides?: Partial<BanquetFormValue>): BanquetFormValue {
  return {
    resourceId: "",
    customerName: "",
    phone: "",
    eventDate: toDateOnlyString(new Date()),
    startTime: "09:00",
    endTime: "12:00",
    eventType: "MEETING",
    headcount: 1,
    linkedAccommodationIds: [],
    status: "RESERVED",
    notes: "",
    cancelReason: "",
    addons: [],
    ...overrides,
  };
}

type ConflictInfo = { customerName: string; resourceName: string; timeRange: string; date: string } | null;

export type BanquetPaymentLedgerProps = {
  paymentId: string;
  breakdown: { label: string; value: number }[];
  expectedTotal: number;
  entries: PaymentEntryValue[];
  staffOptions: StaffOption[];
  currentUserId: string;
};

export function BanquetForm({
  resources,
  accommodationOptions,
  services,
  customers,
  initialOverrides,
  ledger,
}: {
  resources: ResourceOption[];
  accommodationOptions: AccommodationOption[];
  services: ServiceOption[];
  customers: CustomerOption[];
  initialOverrides?: Partial<BanquetFormValue>;
  /** Only present when editing an already-saved booking — a new booking has nowhere to attach entries to yet. */
  ledger?: BanquetPaymentLedgerProps;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [value, setValue] = useState(() => defaultBanquetFormValue(initialOverrides));
  const [initialDeposit, setInitialDeposit] = useState<InitialDepositValue>(DEFAULT_INITIAL_DEPOSIT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<ConflictInfo>(null);
  const [checkingConflict, setCheckingConflict] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasAllFields = !!(value.resourceId && value.eventDate && value.startTime && value.endTime);

  useEffect(() => {
    if (!hasAllFields) {
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setCheckingConflict(true);
      try {
        const res = await fetch("/api/banquet-bookings/check-conflict", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            resourceId: value.resourceId,
            eventDate: value.eventDate,
            startTime: value.startTime,
            endTime: value.endTime,
            excludeBookingId: value.id,
          }),
        });
        const body = await res.json();
        setConflict(body.conflict ? body.with : null);
      } finally {
        setCheckingConflict(false);
      }
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [hasAllFields, value.resourceId, value.eventDate, value.startTime, value.endTime, value.id]);

  const activeConflict = hasAllFields ? conflict : null;
  const selectedResource = resources.find((r) => r.id === value.resourceId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (activeConflict) return;
    setSaving(true);
    setError(null);

    const url = value.id ? `/api/banquet-bookings/${value.id}` : "/api/banquet-bookings";
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

    const saved = await res.json();
    showToast(value.id ? "บันทึกการจองห้องจัดเลี้ยงสำเร็จ" : "จองห้องจัดเลี้ยงสำเร็จ");
    router.push(`/banquet/${saved.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label>ห้องจัดเลี้ยง</Label>
          <Select required value={value.resourceId} onChange={(e) => setValue({ ...value, resourceId: e.target.value })}>
            <option value="">เลือกห้อง</option>
            {resources.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>ชื่อลูกค้า/ผู้ติดต่อ</Label>
          <CustomerNameInput
            required
            value={value.customerName}
            onChange={(customerName) => setValue({ ...value, customerName })}
            onSelectCustomer={(c) => setValue({ ...value, customerName: c.name, phone: c.phone || value.phone })}
            customers={customers}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>เบอร์โทรศัพท์</Label>
          <Input value={value.phone} onChange={(e) => setValue({ ...value, phone: e.target.value })} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>วันที่ใช้งาน</Label>
          <Input
            type="date"
            required
            value={value.eventDate}
            onChange={(e) => setValue({ ...value, eventDate: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>ประเภทงาน</Label>
          <Select value={value.eventType} onChange={(e) => setValue({ ...value, eventType: e.target.value })}>
            {Object.entries(BANQUET_EVENT_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </div>

        <div className="col-span-2 flex flex-col gap-1.5">
          <Label>ช่วงเวลาแบบด่วน</Label>
          <div className="grid grid-cols-3 gap-2">
            {TIME_SLOT_PRESETS.map((preset) => {
              const active = value.startTime === preset.startTime && value.endTime === preset.endTime;
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setValue({ ...value, startTime: preset.startTime, endTime: preset.endTime })}
                  className={cn(
                    "rounded-md border px-2 py-2 text-xs font-medium transition-colors",
                    active
                      ? "border-gold-500 bg-gold-500 text-forest-900"
                      : "border-cream-200 text-ink-600 hover:bg-cream-100"
                  )}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>เวลาเริ่ม</Label>
          <Input
            type="time"
            required
            value={value.startTime}
            onChange={(e) => setValue({ ...value, startTime: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>เวลาสิ้นสุด</Label>
          <Input
            type="time"
            required
            value={value.endTime}
            onChange={(e) => setValue({ ...value, endTime: e.target.value })}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>จำนวนคน</Label>
          <Input
            type="number"
            min={1}
            value={value.headcount}
            onChange={(e) => setValue({ ...value, headcount: Number(e.target.value) })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>สถานะ</Label>
          <Select value={value.status} onChange={(e) => setValue({ ...value, status: e.target.value })}>
            {Object.entries(BANQUET_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </div>

        <div className="col-span-2 flex flex-col gap-1.5">
          <Label>ลิงก์ห้องพัก (ถ้าลูกค้าค้างคืนด้วย เลือกได้หลายห้อง)</Label>
          {accommodationOptions.length === 0 ? (
            <p className="text-sm text-ink-400">ไม่มีรายการห้องพักให้เลือกในขณะนี้</p>
          ) : (
            <div className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-md border border-cream-200 p-2">
              {accommodationOptions.map((a) => {
                const checked = value.linkedAccommodationIds.includes(a.id);
                return (
                  <label
                    key={a.id}
                    className="flex items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-cream-100"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-forest-700"
                      checked={checked}
                      onChange={(e) =>
                        setValue({
                          ...value,
                          linkedAccommodationIds: e.target.checked
                            ? [...value.linkedAccommodationIds, a.id]
                            : value.linkedAccommodationIds.filter((id) => id !== a.id),
                        })
                      }
                    />
                    <span className="text-ink-900">{a.label}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div className="col-span-2 flex flex-col gap-1.5">
          <Label>หมายเหตุ</Label>
          <Textarea rows={2} value={value.notes} onChange={(e) => setValue({ ...value, notes: e.target.value })} />
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

      {value.id && (
        <a
          href={`/quotation/${value.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-forest-700 hover:underline"
        >
          <FileText className="h-4 w-4" />
          สร้างใบเสนอราคา (พิมพ์ / บันทึก PDF)
        </a>
      )}

      {checkingConflict && <p className="text-xs text-ink-400">กำลังตรวจสอบคิวว่าง...</p>}
      <ConflictBanner conflict={activeConflict} />

      {selectedResource && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-md bg-gold-100 px-3 py-2 text-sm">
          <span>
            <span className="text-ink-600">ราคา/ชั่วโมง: </span>
            <span className="font-semibold text-forest-800">
              {selectedResource.hourlyPrice != null ? `${selectedResource.hourlyPrice.toLocaleString("th-TH")} บาท` : "ยังไม่ระบุ"}
            </span>
          </span>
          <span>
            <span className="text-ink-600">ราคาเหมาทั้งวัน: </span>
            <span className="font-semibold text-forest-800">
              {selectedResource.dailyPrice != null ? `${selectedResource.dailyPrice.toLocaleString("th-TH")} บาท` : "ยังไม่ระบุ"}
            </span>
          </span>
        </div>
      )}

      {!value.id && <InitialDepositInput value={initialDeposit} onChange={setInitialDeposit} />}

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button type="submit" variant="gold" disabled={saving || !!activeConflict}>
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
