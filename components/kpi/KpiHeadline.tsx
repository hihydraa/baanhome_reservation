import Link from "next/link";
import { cn } from "@/lib/utils";
import { GRADE_LABELS, type KpiKey } from "@/lib/kpi-config";
import { formatKpi, formatPlain, nf } from "@/lib/kpi-format";
import type { KpiMonth, KpiResult } from "@/lib/kpi";
import { DeltaBadge } from "@/components/kpi/DeltaBadge";
import { GRADE_STYLE } from "@/components/kpi/grade-style";

const shell = "flex flex-col gap-2 rounded-xl border border-cream-200 bg-white p-4";
const title = "text-sm font-medium text-ink-600";

const detailHref = (data: KpiMonth, key: KpiKey) => `/kpi/${key}?month=${data.month}`;

function Bar({ pct, cls }: { pct: number; cls: string }) {
  return (
    <div className="h-2.5 rounded-full bg-cream-200">
      <div className={cn("h-full rounded-full", cls)} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  );
}

function Chip({ kpi }: { kpi: KpiResult }) {
  if (!kpi.grade) return null;
  return <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", GRADE_STYLE[kpi.grade].badge)}>{GRADE_LABELS[kpi.grade]}</span>;
}

/** Value of a KPI with its level chip and the change against last month — used for the small lines in a card. */
function Line({ kpi, label }: { kpi: KpiResult | undefined; label: string }) {
  if (!kpi) return null;
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="whitespace-nowrap text-ink-600">{label}</span>
      <span className="flex items-center gap-2">
        <strong className="text-ink-900">{kpi.value == null ? "—" : formatKpi(kpi.value, kpi.def.unit)}</strong>
        <DeltaBadge cur={kpi.value} prev={kpi.prevValue} unit={kpi.def.unit} />
      </span>
    </div>
  );
}

/** The five figures an executive reads first; every other KPI is in the table below. */
export function KpiHeadline({ data }: { data: KpiMonth }) {
  const by = (key: KpiKey) => data.kpis.find((k) => k.def.key === key);
  const sales = by("TOTAL_SALES");
  const bookings = by("BOOKINGS");
  const resort = by("OCC_RESORT");
  const pool = by("OCC_POOL_VILLA");
  const pace = data.pace;
  const salesPct = sales?.value != null && sales.levels ? (sales.value / sales.levels.excellent) * 100 : null;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
      {/* total score */}
      <div className={shell}>
        <p className={title}>คะแนนรวม</p>
        {data.hasTargets ? (
          <>
            <p className="text-3xl font-semibold text-forest-800">
              {nf(data.points, 1)} <span className="text-base font-normal text-ink-400">/ 100</span>
            </p>
            <Bar pct={(data.points / 120) * 100} cls="bg-forest-700" />
            <div className="flex items-center justify-between text-xs text-ink-500">
              <span>เดือนก่อน {data.prevPoints != null ? nf(data.prevPoints, 1) : "—"}</span>
              {data.prevPoints != null && (
                <span className={cn("font-medium", data.points >= data.prevPoints ? "text-emerald-700" : "text-red-700")}>
                  {data.points >= data.prevPoints ? "▲ +" : "▼ −"}
                  {nf(Math.abs(data.points - data.prevPoints), 1)}
                </span>
              )}
            </div>
            {data.scoredWeight < 100 && <p className="text-xs text-amber-700">มีตัวเลข {data.scoredWeight}% ของน้ำหนัก</p>}
          </>
        ) : (
          <p className="text-sm text-ink-400">ยังไม่มีเป้าหมายของเดือนนี้</p>
        )}
      </div>

      {/* total sales */}
      <div className={shell}>
        <Link href={detailHref(data, "TOTAL_SALES")} className={cn(title, "hover:underline")}>ยอดขายรวม</Link>
        <p className="text-2xl font-semibold text-ink-900">{sales?.value == null ? "—" : `${nf(sales.value)} บาท`}</p>
        {sales?.value != null && sales.levels && (
          <>
            <Bar pct={pace ? pace.toDatePct : (salesPct ?? 0)} cls={sales.grade ? GRADE_STYLE[sales.grade].bar : "bg-forest-700"} />
            {pace ? (
              <>
                <p className="text-xs text-ink-600">
                  <strong>{nf(pace.toDatePct)}%</strong> ของเป้าถึงวันนี้ (เป้าดีเยี่ยม {nf(pace.target)} บาท/เดือน)
                </p>
                <p className="text-xs text-ink-600">คาดสิ้นเดือน {nf(pace.projected)} บาท ({nf((pace.projected / pace.target) * 100)}% ของเป้า)</p>
                {pace.neededPerDay != null && pace.remainingDays > 0 && (
                  <p className="text-xs text-ink-600">
                    ต้องทำวันละ <strong>{nf(pace.neededPerDay)}</strong> บาท (เหลือ {pace.remainingDays} วัน)
                  </p>
                )}
              </>
            ) : (
              <p className="text-xs text-ink-600">
                <strong>{nf(salesPct ?? 0)}%</strong> ของเป้าดีเยี่ยม ({nf(sales.levels.excellent)} บาท)
              </p>
            )}
            <div className="flex items-center justify-between">
              <Chip kpi={sales} />
              <span className="flex items-center gap-1 text-xs text-ink-500">
                เทียบเดือนก่อน <DeltaBadge cur={sales.value} prev={sales.prevValue} unit="baht" />
              </span>
            </div>
          </>
        )}
      </div>

      {/* occupancy */}
      <div className={shell}>
        <Link href={detailHref(data, "OCC_RESORT")} className={cn(title, "hover:underline")}>OCC ห้องพัก</Link>
        {[
          { k: resort, label: "รีสอร์ท" },
          { k: pool, label: "พูลวิลล่า" },
        ].map(({ k, label }) => (
          <div key={label} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between">
              <span className="whitespace-nowrap text-sm text-ink-600">{label}</span>
              <span className="flex items-center gap-2">
                <strong className="text-xl text-ink-900">{k?.value == null ? "—" : `${nf(k.value, 1)}%`}</strong>
                {k && <DeltaBadge cur={k.value} prev={k.prevValue} unit="percent" />}
              </span>
            </div>
            {k?.value != null && k.levels && <Bar pct={(k.value / k.levels.exceed) * 100} cls={k.grade ? GRADE_STYLE[k.grade].bar : "bg-forest-700"} />}
            {k?.levels && (
              <p className="text-[11px] text-ink-400">
                ผ่าน {formatPlain(k.levels.pass, "percent")} · ดีเยี่ยม {formatPlain(k.levels.excellent, "percent")}
              </p>
            )}
          </div>
        ))}
        <p className="text-[11px] text-ink-400">นับรวมการจองล่วงหน้าของทั้งเดือน</p>
      </div>

      {/* restaurant */}
      <div className={shell}>
        <Link href={detailHref(data, "BILLS_PER_DAY")} className={cn(title, "hover:underline")}>สวนอาหาร</Link>
        <Line kpi={by("BILLS_PER_DAY")} label="บิล/วัน" />
        <Line kpi={by("BAHT_PER_BILL")} label="บาท/บิล" />
        <Line kpi={by("GP_RESTAURANT")} label="GP" />
        {data.kpis.some((k) => k.missing === "POS") && <p className="text-xs text-amber-700">ยังอ่านข้อมูล POS ไม่ได้</p>}
      </div>

      {/* bookings */}
      <div className={shell}>
        <Link href={detailHref(data, "BOOKINGS")} className={cn(title, "hover:underline")}>งานจอง</Link>
        <p className="text-2xl font-semibold text-ink-900">{bookings?.value == null ? "—" : `${nf(bookings.value)} งาน`}</p>
        {bookings?.levels && bookings.value != null && (
          <>
            <Bar pct={(bookings.value / bookings.levels.exceed) * 100} cls={bookings.grade ? GRADE_STYLE[bookings.grade].bar : "bg-forest-700"} />
            <p className="text-xs text-ink-600">
              ผ่าน {formatPlain(bookings.levels.pass, "count")} · ดีเยี่ยม {formatPlain(bookings.levels.excellent, "count")}
              {bookings.value < bookings.levels.excellent && <> (ขาดอีก {nf(bookings.levels.excellent - bookings.value, 0)} งาน)</>}
            </p>
            <div className="flex items-center justify-between">
              <Chip kpi={bookings} />
              <DeltaBadge cur={bookings.value} prev={bookings.prevValue} unit="count" />
            </div>
          </>
        )}
        <Line kpi={by("GP_BANQUET")} label="GP งานจอง" />
      </div>
    </div>
  );
}
