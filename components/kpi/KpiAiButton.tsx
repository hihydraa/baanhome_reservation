"use client";

import { useRef, useState } from "react";
import { Copy, FileText, Loader2, Printer, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast-provider";
import { SimpleMarkdown } from "@/components/kpi/SimpleMarkdown";

type Option = { value: string; label: string };

/**
 * ADMIN only: "AI ช่วยวิเคราะห์". Pick a range of months, press วิเคราะห์, and the summary is written below as it
 * streams in. Nothing is saved.
 */
export function KpiAiButton({ options, configured, defaultFrom, defaultTo }: { options: Option[]; configured: boolean; defaultFrom: string; defaultTo: string }) {
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [text, setText] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  const last = options[options.length - 1]?.value ?? defaultTo;
  const shift = (month: string, by: number) => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1 + by, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  };
  const clampFrom = (m: string) => (m < options[0]?.value ? options[0].value : m);
  const presets = [
    { label: "เดือนนี้", from: last, to: last },
    { label: "3 เดือนล่าสุด", from: clampFrom(shift(last, -2)), to: last },
    { label: "ครึ่งปี (ก.ค. ถึงปัจจุบัน)", from: options.find((o) => o.value >= "2026-07")?.value ?? options[0]?.value ?? last, to: last },
  ];
  const rangeError = from > to ? "เดือนเริ่มต้นต้องไม่หลังเดือนสิ้นสุด" : null;

  async function run() {
    abort.current?.abort();
    const ctl = new AbortController();
    abort.current = ctl;
    setRunning(true);
    setError(null);
    setText("");
    try {
      const res = await fetch("/api/kpi-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to }),
        signal: ctl.signal,
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `วิเคราะห์ไม่สำเร็จ (${res.status})`);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        setText((t) => t + decoder.decode(value, { stream: true }));
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError("การวิเคราะห์ถูกตัดกลางคัน ลองกดวิเคราะห์อีกครั้ง");
    } finally {
      setRunning(false);
    }
  }

  function close(next: boolean) {
    if (!next) abort.current?.abort();
    setOpen(next);
  }

  const select = "h-9 rounded-md border border-cream-200 bg-white px-2 text-sm text-forest-800";

  function exportDoc(kind: "pdf" | "word") {
    const body = document.getElementById("kpi-ai-result")?.innerHTML ?? "";
    const range = `${options.find((o) => o.value === from)?.label ?? from} – ${options.find((o) => o.value === to)?.label ?? to}`;
    const css = `body{font-family:"Noto Sans Thai",Tahoma,sans-serif;max-width:780px;margin:24px auto;padding:0 16px;color:#1f2937;line-height:1.6;font-size:14px}h1{font-size:20px;margin:0 0 4px}h2,h3{font-size:16px;margin:18px 0 6px;border-bottom:1px solid #d1d5db;padding-bottom:3px}h4{font-size:14px;margin:12px 0 4px}ul{margin:4px 0 4px 20px;padding:0}table{width:100%;border-collapse:collapse;font-size:12px;margin:4px 0}th,td{border:1px solid #9ca3af;padding:3px 6px;text-align:left}th{background:#f3f4f6}.meta{color:#6b7280;font-size:12px;margin-bottom:12px}.note{color:#6b7280;font-size:11px;margin-top:20px;border-top:1px solid #d1d5db;padding-top:6px}@media print{table,tr{page-break-inside:avoid}h2,h3,h4{page-break-after:avoid}}`;
    const html = `<!doctype html><html lang="th" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>เอกสารประกอบการประชุม KPI</title><style>${css}</style></head><body><h1>เอกสารประกอบการประชุมผลการดำเนินงานประจำเดือน — สวนอาหารบ้านโฮม</h1><div class="meta">ช่วงที่วิเคราะห์: ${range}</div>${body}<div class="note">ตารางตัวเลขสร้างจากระบบ ส่วนวิเคราะห์จัดทำด้วย AI ควรตรวจสอบความถูกต้องก่อนนำเข้าที่ประชุม</div></body></html>`;
    if (kind === "word") {
      const url = URL.createObjectURL(new Blob(["\ufeff", html], { type: "application/msword" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `KPI-meeting-${from}_${to}.doc`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      return;
    }
    const w = window.open("", "_blank");
    if (!w) return showToast("เบราว์เซอร์บล็อกหน้าต่างพิมพ์ กรุณาอนุญาตป๊อปอัป");
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" className="print:hidden" onClick={() => setOpen(true)}>
        <Sparkles className="h-4 w-4 text-gold-600" />
        AI ช่วยวิเคราะห์
      </Button>

      <Dialog open={open} onOpenChange={close}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>AI ช่วยวิเคราะห์ KPI</DialogTitle>
          </DialogHeader>

          {!configured ? (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
              ยังไม่ได้ตั้งค่า AI ที่เซิร์ฟเวอร์ ผู้ดูแลระบบต้องเพิ่มตัวแปร <code>ANTHROPIC_API_KEY</code> ใน Vercel (Settings → Environment Variables) แล้ว Redeploy
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1">
                  <Label>ตั้งแต่เดือน</Label>
                  <select className={select} value={from} onChange={(e) => setFrom(e.target.value)}>
                    {options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <Label>ถึงเดือน</Label>
                  <select className={select} value={to} onChange={(e) => setTo(e.target.value)}>
                    {options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <Button type="button" variant="gold" disabled={running || !!rangeError} onClick={run}>
                  {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  วิเคราะห์
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {presets.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => {
                      setFrom(p.from);
                      setTo(p.to);
                    }}
                    className="rounded-full bg-cream-200 px-3 py-1 text-xs font-medium text-ink-600 hover:bg-cream-100"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              {rangeError && <p className="text-xs text-red-700">{rangeError}</p>}
              {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
              {(text || running) && (
                <div className="flex flex-col gap-2 rounded-lg border border-cream-200 bg-white p-4">
                  {text ? <div id="kpi-ai-result"><SimpleMarkdown text={text} /></div> : <p className="text-sm text-ink-400">กำลังวิเคราะห์ ใช้เวลาประมาณ 20–40 วินาที…</p>}
                  {text && !running && (
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="ghost" size="sm" onClick={() => exportDoc("pdf")}>
                        <Printer className="h-3.5 w-3.5" />
                        ดาวน์โหลด PDF
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => exportDoc("word")}>
                        <FileText className="h-3.5 w-3.5" />
                        ดาวน์โหลด Word
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard?.writeText(text).then(() => showToast("คัดลอกแล้ว"), () => showToast("คัดลอกไม่สำเร็จ"));
                        }}
                      >
                        <Copy className="h-3.5 w-3.5" />
                        คัดลอก
                      </Button>
                    </div>
                  )}
                </div>
              )}
              <p className="text-xs text-ink-400">
                AI วิเคราะห์จากตัวเลขสรุปของหน้า KPI เท่านั้น (ไม่ส่งชื่อลูกค้าหรือเบอร์โทร) อาจผิดพลาดได้ ควรตรวจสอบก่อนนำไปใช้ และระบบไม่บันทึกผลวิเคราะห์ไว้ เลือกได้สูงสุด 12 เดือนต่อครั้ง
              </p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
