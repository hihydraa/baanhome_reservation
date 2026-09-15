"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { PaymentPanel, type PaymentFormValue } from "@/components/payment/PaymentPanel";
import { ConflictBanner } from "@/components/banquet/ConflictBanner";
import { useToast } from "@/components/ui/toast-provider";
import { BANQUET_EVENT_TYPE_LABELS, BANQUET_STATUS_LABELS } from "@/lib/labels";
import { toDateOnlyString } from "@/lib/dates";

type ResourceOption = { id: string; name: string };
type AccommodationOption = { id: string; label: string };

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
  foodService: string;
  linkedAccommodationId: string;
  status: string;
  notes: string;
  cancelReason: string;
  payment: PaymentFormValue;
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
    foodService: "",
    linkedAccommodationId: "",
    status: "RESERVED",
    notes: "",
    cancelReason: "",
    payment: { totalAmount: 0, depositAmount: 0, status: "DEPOSIT", method: "CASH", notes: "" },
    ...overrides,
  };
}

type ConflictInfo = { customerName: string; resourceName: string; timeRange: string; date: string } | null;

export function BanquetForm({
  resources,
  accommodationOptions,
  initialOverrides,
}: {
  resources: ResourceOption[];
  accommodationOptions: AccommodationOption[];
  initialOverrides?: Partial<BanquetFormValue>;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [value, setValue] = useState(() => defaultBanquetFormValue(initialOverrides));
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
      body: JSON.stringify(value),
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
          <Input required value={value.customerName} onChange={(e) => setValue({ ...value, customerName: e.target.value })} />
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
          <Label>บริการอาหารและเครื่องดื่ม</Label>
          <Textarea
            rows={2}
            value={value.foodService}
            onChange={(e) => setValue({ ...value, foodService: e.target.value })}
          />
        </div>

        <div className="col-span-2 flex flex-col gap-1.5">
          <Label>ลิงก์ห้องพัก (ถ้าลูกค้าค้างคืนด้วย)</Label>
          <Select
            value={value.linkedAccommodationId}
            onChange={(e) => setValue({ ...value, linkedAccommodationId: e.target.value })}
          >
            <option value="">ไม่เชื่อมโยงห้องพัก</option>
            {accommodationOptions.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </Select>
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

      {checkingConflict && <p className="text-xs text-ink-400">กำลังตรวจสอบคิวว่าง...</p>}
      <ConflictBanner conflict={activeConflict} />

      <PaymentPanel value={value.payment} onChange={(payment) => setValue({ ...value, payment })} />

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button type="submit" variant="gold" disabled={saving || !!activeConflict}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          บันทึกการจอง
        </Button>
      </div>
    </form>
  );
}
