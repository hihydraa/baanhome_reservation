"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function QuotationActions({ backHref, showRoomPrices = true }: { backHref: string; showRoomPrices?: boolean }) {
  const pathname = usePathname();
  const chip = (active: boolean) =>
    cn("rounded-full px-3 py-1 text-xs font-medium", active ? "bg-forest-700 text-cream-50" : "bg-cream-200 text-ink-600 hover:bg-cream-100");
  return (
    <div className="flex flex-col gap-3 print:hidden">
    <div className="flex items-center justify-between">
      <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 hover:underline">
        <ArrowLeft className="h-4 w-4" />
        กลับไปรายละเอียดการจอง
      </Link>
      <div className="flex flex-col items-end gap-1">
        <Button type="button" variant="gold" onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
          พิมพ์ / บันทึกเป็น PDF
        </Button>
        <p className="text-xs text-ink-400">ในหน้าต่างพิมพ์ ให้เลือกปลายทางเป็น &quot;บันทึกเป็น PDF&quot; เพื่อบันทึกไฟล์</p>
      </div>
    </div>
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-cream-200 bg-white px-3 py-2 text-sm">
      <span className="text-ink-700">ระบุราคาห้องพัก/ห้องจัดเลี้ยงในใบเสนอราคา</span>
      <Link href={pathname} replace className={chip(showRoomPrices)}>
        ระบุราคา
      </Link>
      <Link href={`${pathname}?rooms=hide`} replace className={chip(!showRoomPrices)}>
        ไม่ระบุราคา
      </Link>
      {!showRoomPrices && <span className="text-xs text-ink-400">ไม่แสดงรายการค่าห้อง และยอดรวมด้านล่างไม่รวมค่าห้อง</span>}
    </div>
    </div>
  );
}
