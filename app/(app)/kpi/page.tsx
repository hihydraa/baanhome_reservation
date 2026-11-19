import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { auth } from "@/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { todayDateOnly, toDateOnlyString } from "@/lib/dates";
import { loadKpiMonth } from "@/lib/kpi";
import { KpiAlerts } from "@/components/kpi/KpiAlerts";
import { KpiHeadline } from "@/components/kpi/KpiHeadline";
import { KpiMatrix } from "@/components/kpi/KpiMatrix";
import { KpiHalfYear } from "@/components/kpi/KpiHalfYear";
import { KpiTrends, KpiTrendsFallback } from "@/components/kpi/KpiTrends";
import { MonthPicker } from "@/components/kpi/MonthPicker";
import { buildAlerts } from "@/lib/kpi-alerts";
import { KpiInputForm } from "@/components/kpi/KpiInputForm";
import { KpiToolbar } from "@/components/kpi/KpiToolbar";
import { KpiAiButton } from "@/components/kpi/KpiAiButton";
import { aiConfigured } from "@/lib/kpi-ai";

// Print/PDF: landscape A4, keep the colours, and keep each card in one piece.
const PRINT_CSS = `@media print { @page { size: A4 landscape; margin: 10mm; } .kpi-page, .kpi-page * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .kpi-page { zoom: 0.64; } .kpi-page > *:not(.kpi-matrix) { break-inside: avoid; } .kpi-page tr { break-inside: avoid; } }`;

// Always read the latest bookings and POS sales.
export const dynamic = "force-dynamic";
// Reading the POS sheet can take a few seconds.
export const maxDuration = 30;

const THAI_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const monthTitle = (m: string) => `${THAI_MONTHS[Number(m.slice(5, 7)) - 1]} ${Number(m.slice(0, 4)) + 543}`;
const shiftMonth = (m: string, by: number) => {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(Date.UTC(y, mo - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};
const baht = (n: number) => `${n.toLocaleString("th-TH", { maximumFractionDigits: 0 })} บาท`;

/**
 * One-page KPI scorecard for the executives: the nine BaanHome KPIs for a month with the target levels, the weighted
 * score, and where the sales come from. ADMIN and AUDITOR can open it; only ADMIN can enter the hand-typed figures.
 */
export default async function KpiPage({ searchParams }: { searchParams: Promise<{ month?: string; view?: string }> }) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "AUDITOR")) redirect("/dashboard");
  const isAdmin = session.user.role === "ADMIN";

  const currentMonth = toDateOnlyString(todayDateOnly()).slice(0, 7);
  const { month: monthParam, view } = await searchParams;
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(monthParam ?? "") ? monthParam! : currentMonth;

  const chip = (active: boolean) =>
    cn("rounded-full px-3 py-1.5 text-xs font-medium", active ? "bg-forest-700 text-cream-50" : "bg-cream-200 text-ink-600 hover:bg-cream-100");
  const updatedAt = new Date().toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" });

  // Months the AI can analyse: from the first month with targets up to this month.
  const aiMonths: { value: string; label: string }[] = [];
  for (let m = "2026-07"; m <= currentMonth; m = shiftMonth(m, 1)) aiMonths.push({ value: m, label: monthTitle(m) });
  const aiButton = isAdmin && aiMonths.length > 0 ? (
    <KpiAiButton options={aiMonths} configured={aiConfigured()} defaultFrom={aiMonths[Math.max(0, aiMonths.length - 3)].value} defaultTo={aiMonths[aiMonths.length - 1].value} />
  ) : null;

  if (view === "h2") {
    return (
      <div className="kpi-page flex flex-col gap-5">
        <style>{PRINT_CSS}</style>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-forest-800">KPI Dashboard — BaanHome (BH)</h1>
            <p className="text-sm text-ink-400">ครึ่งปีหลัง 2569 · อัปเดตล่าสุด {updatedAt} น.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <KpiToolbar />
            {aiButton}
            <Link href="/kpi" className={chip(false)}>
              รายเดือน
            </Link>
            <Link href="/kpi?view=h2" className={chip(true)}>
              ครึ่งปี ก.ค.–ธ.ค.
            </Link>
          </div>
        </div>
        <Suspense fallback={<KpiTrendsFallback />}>
          <KpiHalfYear />
        </Suspense>
      </div>
    );
  }

  const data = await loadKpiMonth(month);
  const alerts = buildAlerts(data, isAdmin);
  // Every month from the first one with targets up to the later of this month and December, plus the one being viewed.
  const optionMonths = new Set<string>([month]);
  for (let m = "2026-07"; m <= (currentMonth > "2026-12" ? currentMonth : "2026-12"); m = shiftMonth(m, 1)) optionMonths.add(m);
  const monthOptions = [...optionMonths].sort().map((m) => ({ value: m, label: monthTitle(m) }));
  const salesParts = [
    { label: "สวนอาหาร (POS)", value: data.sales.food, cls: "bg-amber-400" },
    { label: "ห้องพัก", value: data.sales.accommodation, cls: "bg-emerald-500" },
    { label: "งานจัดเลี้ยง/ห้องประชุม", value: data.sales.banquet, cls: "bg-sky-500" },
  ];
  const salesTotal = salesParts.reduce((s, p) => s + (p.value ?? 0), 0);

  const navBtn = "flex h-9 w-9 items-center justify-center rounded-full border border-cream-200 bg-white text-forest-800 hover:bg-cream-100";

  return (
    <div className="kpi-page flex flex-col gap-5">
      <style>{PRINT_CSS}</style>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-forest-800">KPI Dashboard — BaanHome (BH)</h1>
          <p className="text-sm text-ink-400">
            {monthTitle(month)} · อัปเดตล่าสุด {updatedAt} น.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <KpiToolbar />
          {aiButton}
          <Link href={`/kpi?month=${shiftMonth(month, -1)}`} className={navBtn} aria-label="เดือนก่อน">
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <MonthPicker month={month} options={monthOptions} />
          <Link href={`/kpi?month=${shiftMonth(month, 1)}`} className={navBtn} aria-label="เดือนถัดไป">
            <ChevronRight className="h-4 w-4" />
          </Link>
          <Link href="/kpi" className={chip(month === currentMonth)}>
            เดือนนี้
          </Link>
          <Link href={`/kpi?month=${shiftMonth(currentMonth, -1)}`} className={chip(month === shiftMonth(currentMonth, -1))}>
            เดือนที่แล้ว
          </Link>
          <Link href="/kpi?view=h2" className={chip(false)}>
            ครึ่งปี ก.ค.–ธ.ค.
          </Link>
        </div>
      </div>

      {data.warnings.map((w) => (
        <p key={w} className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {w}
        </p>
      ))}
      {data.inProgress && (
        <p className="rounded-md bg-cream-200 px-3 py-2 text-xs text-ink-600">
          เดือนนี้ยังไม่จบ (ข้อมูลร้านอาหารถึงวันที่ {data.elapsedDays} จาก {data.daysInMonth} วัน) ยอดขายและจำนวนที่นับสะสมจะเพิ่มขึ้นอีกจนสิ้นเดือน ส่วน OCC นับรวมการจองล่วงหน้าของทั้งเดือน
        </p>
      )}

      {!data.hasTargets && (
        <p className="rounded-md bg-cream-200 px-3 py-2 text-sm text-ink-600">
          ชีตเป้าหมาย KPI ครอบคลุมเดือน ก.ค. – ธ.ค. 2569 เดือนนี้จึงแสดงตัวเลขจริงอย่างเดียว ยังไม่มีเป้าหมายและคะแนน
        </p>
      )}

      {data.hasTargets && <KpiAlerts alerts={alerts} />}
      <KpiHeadline data={data} />
      <KpiMatrix data={data} />
      <Suspense fallback={<KpiTrendsFallback />}>
        <KpiTrends month={month} />
      </Suspense>

      <Card>
        <CardHeader>
          <CardTitle>ยอดขายรวมมาจากไหน</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {salesTotal > 0 && (
            <div className="flex h-4 overflow-hidden rounded-full bg-cream-200">
              {salesParts.map((p) =>
                p.value ? <div key={p.label} className={p.cls} style={{ width: `${(p.value / salesTotal) * 100}%` }} title={p.label} /> : null
              )}
            </div>
          )}
          <div className="grid gap-2 sm:grid-cols-3">
            {salesParts.map((p) => (
              <div key={p.label} className="flex items-center gap-2 rounded-lg bg-cream-100 px-3 py-2">
                <span className={cn("h-3 w-3 rounded-full", p.cls)} />
                <div>
                  <p className="text-xs text-ink-600">{p.label}</p>
                  <p className="text-sm font-semibold text-ink-900">{p.value == null ? "— (อ่านข้อมูลไม่ได้)" : baht(p.value)}</p>
                </div>
              </div>
            ))}
          </div>
          {data.sales.upcoming > 0 && <p className="text-xs text-ink-500">ยังมียอดห้องพักและงานจัดเลี้ยงที่จองล่วงหน้า (ยังไม่ถึงวันให้บริการ) อีก {baht(data.sales.upcoming)} ซึ่งยังไม่นับรวมข้างต้น</p>}
        </CardContent>
      </Card>

      {isAdmin && (
        <Card className="print:hidden">
          <CardHeader>
            <CardTitle>ตัวเลขที่กรอกเอง — {monthTitle(month)}</CardTitle>
          </CardHeader>
          <CardContent>
            <KpiInputForm
              key={month}
              month={month}
              initial={{ banquetCost: data.inputs.banquetCost, restaurantGp: data.inputs.restaurantGp, evaluationPct: data.inputs.evaluationPct }}
              updatedBy={data.inputs.updatedByName}
            />
          </CardContent>
        </Card>
      )}

      <details className="rounded-lg border border-cream-200 bg-white px-4 py-3 text-sm text-ink-600 print:hidden">
        <summary className="cursor-pointer font-medium text-forest-800">วิธีคิดคะแนนและแหล่งข้อมูล</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>แต่ละ KPI มี 4 ระดับตามชีต Target BH: น้อยสุด (0%), ผ่าน (50%), ดีเยี่ยม (100%) และเกินเป้าหมาย (120%) ได้คะแนนเป็นสัดส่วนของน้ำหนัก คำนวณต่อเนื่องเป็นเส้นตรงระหว่างระดับ ต่ำกว่าระดับน้อยสุดได้ 0 และไม่เกิน 120%</li>
          <li>คะแนนรวม = ผลรวมของ (น้ำหนัก × % คะแนน) ของ KPI ทั้ง 9 ตัว น้ำหนักรวม 100</li>
          <li>OCC, งานจอง และรายได้ห้องพัก/งานจัดเลี้ยง มาจากระบบจองนี้ ส่วนบิลและยอดขายร้านอาหารอ่านสดจาก Google Sheet ของ POS (เดียวกับหน้ายอดขายร้านอาหาร) โดยนับเฉพาะรายการที่ไม่ใช่ที่พัก</li>
          <li>ยอดขายรวม = ยอดขายอาหาร + รายได้ห้องพัก + รายได้งานจัดเลี้ยง ที่ถึงวันให้บริการแล้ว (ราคารวม VAT) ห้องพักใน POS ไม่นับซ้ำ</li>
          <li>GP สวนอาหาร, ต้นทุนงานจอง และคะแนนการประเมิน เป็นตัวเลขที่ผู้ดูแลระบบกรอกรายเดือน</li>
        </ul>
      </details>
    </div>
  );
}
