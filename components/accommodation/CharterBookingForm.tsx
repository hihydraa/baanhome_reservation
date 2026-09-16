"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { PaymentPanel, type PaymentFormValue } from "@/components/payment/PaymentPanel";
import { useToast } from "@/components/ui/toast-provider";
import { SOURCE_LABELS, ACCOMMODATION_STATUS_LABELS } from "@/lib/labels";
import { toDateOnlyString } from "@/lib/dates";
import { cn } from "@/lib/utils";

type ChargeScope = "RESORT" | "POOL_VILLA" | "ALL";

const SCOPE_OPTIONS: { value: ChargeScope; label: string }[] = [
  { value: "RESORT", label: "เหมารีสอร์ต" },
  { value: "POOL_VILLA", label: "เหมาพูลวิลล่า" },
  { value: "ALL", label: "เหมาทั้งหมด" },
];

export function CharterBookingForm({
  initialCheckIn,
  onSaved,
  onCancel,
}: {
  initialCheckIn?: string;
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const today = toDateOnlyString(new Date());

  const [scope, setScope] = useState<ChargeScope>("RESORT");
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [source, setSource] = useState("WALK_IN");
  const [checkIn, setCheckIn] = useState(initialCheckIn ?? today);
  const [checkOut, setCheckOut] = useState(initialCheckIn ?? today);
  const [guestCount, setGuestCount] = useState(1);
  const [status, setStatus] = useState("RESERVED");
  const [notes, setNotes] = useState("");
  const [payment, setPayment] = useState<PaymentFormValue>({
    totalAmount: 0,
    depositAmount: 0,
    status: "PAY_LATER",
    method: "CASH",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const res = await fetch("/api/accommodation-bookings/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scope,
        customerName,
        phone,
        source,
        checkIn,
        checkOut,
        guestCount,
        status,
        notes,
        payment,
      }),
    });

    setSaving(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "เกิดข้อผิดพลาด กรุณาลองใหม่");
      return;
    }

    const body = await res.json();
    showToast(`เหมาสำเร็จ ${body.count} ห้อง`);
    router.refresh();
    onSaved?.();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label>เลือกโซนที่ต้องการเหมา</Label>
        <div className="grid grid-cols-3 gap-2">
          {SCOPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setScope(opt.value)}
              className={cn(
                "rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                scope === opt.value
                  ? "border-gold-500 bg-gold-500 text-forest-900"
                  : "border-cream-200 text-ink-600 hover:bg-cream-100"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label>ชื่อลูกค้า</Label>
          <Input required value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>เบอร์โทรศัพท์</Label>
          <Input required value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>ช่องทางการจอง</Label>
          <Select value={source} onChange={(e) => setSource(e.target.value)}>
            {Object.entries(SOURCE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>จำนวนผู้เข้าพักรวม</Label>
          <Input
            type="number"
            min={1}
            value={guestCount}
            onChange={(e) => setGuestCount(Number(e.target.value))}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>วันที่เช็คอิน</Label>
          <Input type="date" required value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>วันที่เช็คเอาท์</Label>
          <Input type="date" required value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
        </div>

        <div className="col-span-2 flex flex-col gap-1.5">
          <Label>สถานะ</Label>
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            {Object.entries(ACCOMMODATION_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </div>

        <div className="col-span-2 flex flex-col gap-1.5">
          <Label>หมายเหตุ</Label>
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>

      <p className="text-xs text-ink-400">
        ยอดชำระด้านล่างจะถูกบันทึกไว้ที่ห้องแรกของกลุ่มเท่านั้น ห้องอื่นในกลุ่มเดียวกันจะไม่มียอดซ้ำ
      </p>
      <PaymentPanel value={payment} onChange={setPayment} />

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            ยกเลิก
          </Button>
        )}
        <Button type="submit" variant="gold" disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          บันทึกการเหมา
        </Button>
      </div>
    </form>
  );
}
