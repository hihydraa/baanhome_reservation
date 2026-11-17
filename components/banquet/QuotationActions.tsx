"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ProjectSource = "auto" | "notes" | "both";

export function QuotationActions({
  backHref,
  showRoomPrices = true,
  projectSource = "auto",
  hasNotes = false,
}: {
  backHref: string;
  showRoomPrices?: boolean;
  projectSource?: ProjectSource;
  hasNotes?: boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // This page's address with one option changed, keeping the others (price option and project text).
  const href = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams.toString());
    if (value == null) next.delete(key);
    else next.set(key, value);
    const qs = next.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };
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
      <Link href={href("rooms", null)} replace className={chip(showRoomPrices)}>
        ระบุราคา
      </Link>
      <Link href={href("rooms", "hide")} replace className={chip(!showRoomPrices)}>
        ไม่ระบุราคา
      </Link>
      {!showRoomPrices && <span className="text-xs text-ink-400">ไม่แสดงรายการค่าห้อง และยอดรวมด้านล่างไม่รวมค่าห้อง</span>}
    </div>
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-cream-200 bg-white px-3 py-2 text-sm">
      <span className="text-ink-700">ข้อความในช่อง Project</span>
      <Link href={href("project", null)} replace className={chip(projectSource === "auto")}>
        วันที่/ห้อง/จำนวนท่าน
      </Link>
      <Link href={href("project", "notes")} replace className={chip(projectSource === "notes")}>
        หมายเหตุของการจอง
      </Link>
      <Link href={href("project", "both")} replace className={chip(projectSource === "both")}>
        ทั้งสองอย่าง
      </Link>
      {!hasNotes && projectSource !== "auto" && <span className="text-xs text-amber-700">การจองนี้ยังไม่มีหมายเหตุ จึงแสดงเป็นแบบแรก</span>}
    </div>
    <p className="px-1 text-xs text-ink-500">
      แตะที่ข้อความ <strong>ที่อยู่ / เลขประจำตัว / Project</strong> ในใบเสนอราคาเพื่อแก้ไขได้เลย (แก้เฉพาะใบนี้ในเครื่องนี้ ไม่เปลี่ยนข้อมูลการจองหรือฐานข้อมูลลูกค้า)
    </p>
    </div>
  );
}
