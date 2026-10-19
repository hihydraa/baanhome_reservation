"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast-provider";

/** Print the sheet and let the counter confirm they checked it (stands in for the paper signature). */
export function DailySheetActions({ date, reviewedLabel }: { date: string; reviewedLabel: string | null }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);

  async function confirm() {
    setSaving(true);
    const res = await fetch("/api/housekeeping/day-review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date }),
    });
    setSaving(false);
    if (res.ok) {
      showToast("บันทึกการตรวจแล้ว");
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      showToast(body.error ?? `บันทึกไม่สำเร็จ (${res.status})`);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <Button type="button" variant="gold" disabled={saving} onClick={confirm}>
        <CheckCircle2 className="h-4 w-4" />
        {reviewedLabel ? "ตรวจแล้ว (กดเพื่อบันทึกใหม่)" : "เคาน์เตอร์ตรวจแล้ว"}
      </Button>
      <Button type="button" variant="outline" onClick={() => window.print()}>
        <Printer className="h-4 w-4" />
        พิมพ์
      </Button>
    </div>
  );
}
