"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast-provider";

type Values = { banquetCost: number | null; restaurantGp: number | null; evaluationPct: number | null };

/** ADMIN only: the three figures the KPI page cannot work out by itself, for one month. Empty = not entered. */
export function KpiInputForm({ month, initial, updatedBy }: { month: string; initial: Values; updatedBy: string | null }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [cost, setCost] = useState(initial.banquetCost?.toString() ?? "");
  const [gp, setGp] = useState(initial.restaurantGp?.toString() ?? "");
  const [evalPct, setEvalPct] = useState(initial.evaluationPct?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toNum = (s: string) => (s.trim() === "" ? null : Number(s));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/kpi-inputs", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month, banquetCost: toNum(cost), restaurantGp: toNum(gp), evaluationPct: toNum(evalPct) }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? `บันทึกไม่สำเร็จ (${res.status})`);
      return;
    }
    showToast("บันทึกตัวเลข KPI แล้ว");
    router.refresh();
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label>ต้นทุนงานจัดเลี้ยง/งานจอง (บาท)</Label>
          <Input type="number" min={0} step="0.01" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="เช่น 85000" />
          <p className="text-xs text-ink-400">เทียบกับรายได้งานจัดเลี้ยงของเดือน (รวม VAT ตามระบบ) เพื่อคิด GP-งานจอง</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>%GP สวนอาหาร</Label>
          <Input type="number" min={0} max={100} step="0.01" inputMode="decimal" value={gp} onChange={(e) => setGp(e.target.value)} placeholder="เช่น 62.5" />
          <p className="text-xs text-ink-400">% กำไรขั้นต้น/ยอดขาย ของร้านอาหารในเดือนนี้</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>%คะแนนการประเมิน</Label>
          <Input type="number" min={0} max={100} step="0.01" inputMode="decimal" value={evalPct} onChange={(e) => setEvalPct(e.target.value)} placeholder="เช่น 85" />
          <p className="text-xs text-ink-400">% คะแนนที่ได้จากการตรวจ/คะแนนเต็ม (แบบประเมิน PM)</p>
        </div>
      </div>
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          บันทึก
        </Button>
        {updatedBy && <span className="text-xs text-ink-400">แก้ไขล่าสุดโดย {updatedBy}</span>}
      </div>
    </form>
  );
}
