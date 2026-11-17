import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { auth } from "@/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { todayDateOnly, toDateOnlyString } from "@/lib/dates";
import { loadKpiMonth } from "@/lib/kpi";
import { KpiCard } from "@/components/kpi/KpiCard";
import { KpiInputForm } from "@/components/kpi/KpiInputForm";

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
const nf = (n: number, digits = 0) => n.toLocaleString("th-TH", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const baht = (n: number) => `${nf(n)} บาท`;

function overallGrade(points: number) {
  if (points >= 120) return { label: "เกินเป้าหมาย", cls: "bg-emerald-100 text-emerald-800" };
  if (points >= 100) return { label: "ดีเยี่ยม", cls: "bg-lime-100 text-lime-800" };
  if (points >= 50) return { label: "ผ่าน", cls: "bg-amber-100 text-amber-800" };
  return { label: "ต่ำกว่าเกณฑ์ผ่าน", cls: "bg-red-100 text-red-800" };
}

/**
 * One-page KPI scorecard for the executives: the nine BaanHome KPIs for a month with the target levels, the weighted
 * score, and where the sales come from. ADMIN and AUDITOR can open it; only ADMIN can enter the hand-typed figures.
 */
export default async function KpiPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "AUDITOR")) redirect("/dashboard");
  const isAdmin = session.user.role === "ADMIN";

  const currentMonth = toDateOnlyString(todayDateOnly()).slice(0, 7);
  const { month: monthParam } = await searchParams;
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(monthParam ?? "") ? monthParam! : currentMonth;

  const data = await loadKpiMonth(month);
  const reached = data.kpis.filter((k) => k.grade === "EXCELLENT" || k.grade === "EXCEED").length;
  const below = data.kpis.filter((k) => k.grade === "BELOW").length;
  const waiting = data.kpis.filter((k) => k.value == null).length;
  const grade = overallGrade(data.points);
  const salesParts = [
    { label: "สวนอาหาร (POS)", value: data.sales.food, cls: "bg-amber-400" },
    { label: "ห้องพัก", value: data.sales.accommodation, cls: "bg-emerald-500" },
    { label: "งานจัดเลี้ยง/ห้องประชุม", value: data.sales.banquet, cls: "bg-sky-500" },
  ];
  const salesTotal = salesParts.reduce((s, p) => s + (p.value ?? 0), 0);

  const navBtn = "flex h-9 w-9 items-center justify-center rounded-full border border-cream-200 bg-white text-forest-800 hover:bg-cream-100";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-forest-800">KPI Dashboard — BaanHome (BH)</h1>
          <p className="text-sm text-ink-400">สรุป KPI ทั้ง 9 ตัวในหน้าเดียว เทียบกับเป้าหมายของเดือน</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/kpi?month=${shiftMonth(month, -1)}`} className={navBtn} aria-label="เดือนก่อน">
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <span className="min-w-40 text-center text-lg font-semibold text-forest-800">{monthTitle(month)}</span>
          <Link href={`/kpi?month=${shiftMonth(month, 1)}`} className={navBtn} aria-label="เดือนถัดไป">
            <ChevronRight className="h-4 w-4" />
          </Link>
          {month !== currentMonth && (
            <Link href="/kpi" className="ml-1 rounded-full border border-cream-200 px-3 py-1.5 text-xs font-medium text-forest-700 hover:bg-cream-100">
              เดือนนี้
            </Link>
          )}
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

      {data.hasTargets ? (
        <Card>
          <CardContent className="flex flex-col gap-4 pt-6 lg:flex-row lg:items-center">
            <div className="flex flex-col gap-1 lg:w-72">
              <p className="text-sm text-ink-500">คะแนนรวมเดือนนี้</p>
              <p className="text-4xl font-semibold text-forest-800">
                {nf(data.points, 1)} <span className="text-lg font-normal text-ink-400">/ 100</span>
              </p>
              <span className={cn("w-fit rounded-full px-3 py-1 text-sm font-medium", grade.cls)}>{grade.label}</span>
              {data.scoredWeight < 100 && <p className="text-xs text-amber-700">มีตัวเลขแล้ว {data.scoredWeight}% ของน้ำหนักทั้งหมด (อีก {100 - data.scoredWeight}% รอข้อมูล)</p>}
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <div className="relative h-4 rounded-full bg-cream-200">
                <div className="h-full rounded-full bg-forest-700" style={{ width: `${Math.min(100, (data.points / 120) * 100)}%` }} />
                {[50, 100].map((t) => (
                  <span key={t} className="absolute top-[-3px] h-[22px] w-px bg-ink-400" style={{ left: `${(t / 120) * 100}%` }} />
                ))}
              </div>
              <div className="relative h-4 text-[11px] text-ink-500">
                <span className="absolute left-0">0</span>
                <span className="absolute -translate-x-1/2" style={{ left: `${(50 / 120) * 100}%` }}>
                  50 ผ่าน
                </span>
                <span className="absolute -translate-x-1/2" style={{ left: `${(100 / 120) * 100}%` }}>
                  100 ดีเยี่ยม
                </span>
                <span className="absolute right-0">120</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-emerald-50 p-2">
                  <p className="text-xl font-semibold text-emerald-700">{reached}</p>
                  <p className="text-xs text-ink-600">KPI ถึงระดับดีเยี่ยมขึ้นไป</p>
                </div>
                <div className={cn("rounded-lg p-2", below > 0 ? "bg-red-50" : "bg-cream-100")}>
                  <p className={cn("text-xl font-semibold", below > 0 ? "text-red-700" : "text-forest-800")}>{below}</p>
                  <p className="text-xs text-ink-600">KPI ต่ำกว่าเกณฑ์ผ่าน</p>
                </div>
                <div className={cn("rounded-lg p-2", waiting > 0 ? "bg-amber-50" : "bg-cream-100")}>
                  <p className={cn("text-xl font-semibold", waiting > 0 ? "text-amber-700" : "text-forest-800")}>{waiting}</p>
                  <p className="text-xs text-ink-600">KPI รอข้อมูล</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <p className="rounded-md bg-cream-200 px-3 py-2 text-sm text-ink-600">
          ชีตเป้าหมาย KPI ครอบคลุมเดือน ก.ค. – ธ.ค. 2569 เดือนนี้จึงแสดงตัวเลขจริงอย่างเดียว ยังไม่มีเป้าหมายและคะแนน
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {data.kpis.map((k) => (
          <KpiCard key={k.def.key} kpi={k} />
        ))}
      </div>

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
        <Card>
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

      <details className="rounded-lg border border-cream-200 bg-white px-4 py-3 text-sm text-ink-600">
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
