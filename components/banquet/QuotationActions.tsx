"use client";

import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function QuotationActions({ backHref }: { backHref: string }) {
  return (
    <div className="flex items-center justify-between print:hidden">
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
  );
}
