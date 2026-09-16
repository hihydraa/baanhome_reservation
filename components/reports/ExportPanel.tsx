"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toDateOnlyString, shiftDate, todayDateOnly } from "@/lib/dates";

export function ExportPanel() {
  const today = todayDateOnly();
  const monthAgo = shiftDate(today, -30);
  const [from, setFrom] = useState(toDateOnlyString(monthAgo));
  const [to, setTo] = useState(toDateOnlyString(today));

  const invalid = !from || !to || from > to;

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-cream-200 bg-white p-5">
      <div>
        <p className="text-sm font-semibold text-forest-800">ส่งออกรายงานการจอง</p>
        <p className="text-sm text-ink-600">
          เลือกช่วงวันที่เพื่อส่งออกรายการจองห้องพักและห้องจัดเลี้ยงทั้งหมดเป็นไฟล์ CSV (เปิดด้วย Excel ได้)
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label>ตั้งแต่วันที่</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-44" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>ถึงวันที่</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-44" />
        </div>
        <Button asChild variant="gold" className={cn(invalid && "pointer-events-none opacity-50")}>
          <a
            href={invalid ? undefined : `/api/reports/export?from=${from}&to=${to}`}
            aria-disabled={invalid}
            onClick={(e) => invalid && e.preventDefault()}
          >
            <Download className="h-4 w-4" />
            ดาวน์โหลด CSV
          </a>
        </Button>
      </div>
      {invalid && <p className="text-xs text-red-600">กรุณาเลือกวันที่ให้ถูกต้อง (วันเริ่มต้องไม่เกินวันสิ้นสุด)</p>}
    </div>
  );
}
