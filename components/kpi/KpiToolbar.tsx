"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Print / save as PDF for the meeting (the browser's print dialog; choose "Save as PDF"). */
export function KpiToolbar() {
  return (
    <div className="flex items-center gap-2 print:hidden">
      <Button type="button" variant="gold" size="sm" onClick={() => window.print()}>
        <Printer className="h-4 w-4" />
        พิมพ์ / บันทึกเป็น PDF
      </Button>
    </div>
  );
}
