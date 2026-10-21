"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast-provider";

/** The auditor's outcome for one finding: clear it (it is fine) or confirm it, each with a written reason. */
export function FindingReview({ id, status }: { id: string; status: "OPEN" | "CLEARED" | "CONFIRMED" }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [pending, setPending] = useState<"CLEARED" | "CONFIRMED" | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(next: "OPEN" | "CLEARED" | "CONFIRMED", reason?: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/audit-findings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next, note: reason }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(data.error ?? "บันทึกไม่สำเร็จ", "error");
        return;
      }
      setPending(null);
      setNote("");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  if (status !== "OPEN") {
    return (
      <Button type="button" size="sm" variant="outline" disabled={saving} onClick={() => save("OPEN")}>
        เปิดเรื่องใหม่
      </Button>
    );
  }

  if (pending) {
    return (
      <div className="flex min-w-56 flex-col gap-1.5">
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="เหตุผล" autoFocus />
        <div className="flex gap-1.5">
          <Button type="button" size="sm" variant="gold" disabled={saving || note.trim().length < 3} onClick={() => save(pending, note.trim())}>
            {pending === "CLEARED" ? "ยืนยัน: ปกติ" : "ยืนยัน: ผิดปกติ"}
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={saving} onClick={() => setPending(null)}>
            ยกเลิก
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-1.5">
      <Button type="button" size="sm" variant="outline" onClick={() => setPending("CLEARED")}>
        ปกติ
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={() => setPending("CONFIRMED")}>
        ผิดปกติ
      </Button>
    </div>
  );
}
