import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { loadPerformance } from "@/lib/performance";
import { toDateOnlyString, todayDateOnly } from "@/lib/dates";
import { GRADE_LABELS, KPI_DEFS, type KpiKey } from "@/lib/kpi-config";
import { formatKpi, formatPlain, nf, shortMonthLabel } from "@/lib/kpi-format";
import { listBigBookings, loadKpiMonth, loadKpiSeries } from "@/lib/kpi";
import { loadPosMonth } from "@/lib/pos-sheet";
import { parseDateOnly, shiftDate } from "@/lib/dates";
import { BarTrend, Legend } from "@/components/kpi/charts";
import { GRADE_STYLE } from "@/components/kpi/grade-style";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const THAI_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const monthTitle = (m: string) => `${THAI_MONTHS[Number(m.slice(5, 7)) - 1]} ${Number(m.slice(0, 4)) + 543}`;
const GREEN = "#2f7d57";

/** One KPI in depth: how it is measured, the levels, six months of trend, and what the month's figure is made of. */
export default async function KpiDetailPage({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<{ month?: string }> }) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "AUDITOR")) redirect("/dashboard");

  const { key } = await params;
  const def = KPI_DEFS.find((d) => d.key === key);
  if (!def) notFound();
  const currentMonth = toDateOnlyString(todayDateOnly()).slice(0, 7);
  const { month: monthParam } = await searchParams;
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(monthParam ?? "") ? monthParam! : currentMonth;

  const [data, series] = await Promise.all([loadKpiMonth(month), loadKpiSeries(month, 6)]);
  const kpi = data.kpis.find((k) => k.def.key === def.key)!;
  const style = kpi.grade ? GRADE_STYLE[kpi.grade] : null;
  const k = def.key as KpiKey;

  const trend = series.map((s) => {
    const cell = s.kpis[k];
    return { label: shortMonthLabel(s.month), value: cell?.value ?? null, target: cell?.levels?.excellent ?? null, color: cell?.grade ? undefined : undefined };
  });

  // The month's detail depends on the KPI.
  const monthStart = parseDateOnly(`${month}-01`);
  const nextStart = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1));
  const monthEnd = shiftDate(nextStart, -1);
  const needsPos = k === "BILLS_PER_DAY" || k === "BAHT_PER_BILL" || k === "TOTAL_SALES";
  const [perf, big, pos] = await Promise.all([
    k === "OCC_RESORT" || k === "OCC_POOL_VILLA" ? loadPerformance(`${month}-01`, toDateOnlyString(monthEnd)) : null,
    k === "BOOKINGS" ? listBigBookings(monthStart, nextStart) : null,
    needsPos ? loadPosMonth(month) : null,
  ]);
  const zone = k === "OCC_RESORT" ? "RESORT" : "POOL_VILLA";
  const rooms = perf ? perf.accommodationOcc.byRoom.filter((r) => r.zone === zone).sort((a, b) => b.rate - a.rate) : [];
  const daily = pos && "data" in pos ? pos.data.daily : [];
  const lvl = kpi.levels;

  return (
    <div className="flex flex-col gap-5">
      <Link href={`/kpi?month=${month}`} className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-forest-700 hover:underline">
        <ArrowLeft className="h-4 w-4" />
        กลับหน้า KPI
      </Link>

      <div>
        <h1 className="text-xl font-semibold text-forest-800">
          {def.label} <span className="text-base font-normal text-ink-400">— {monthTitle(month)}</span>
        </h1>
        <p className="text-sm text-ink-600">{def.measure}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-cream-200 bg-white p-4">
          <p className="text-sm text-ink-600">ผลของเดือนนี้</p>
          <p className="text-2xl font-semibold text-ink-900">{kpi.value == null ? "—" : formatKpi(kpi.value, def.unit)}</p>
          {kpi.grade && style && <span className={cn("mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium", style.badge)}>{GRADE_LABELS[kpi.grade]}</span>}
          {kpi.value == null && <p className="text-xs text-amber-700">{kpi.missing === "INPUT" ? "ยังไม่ได้กรอก" : kpi.missing === "POS" ? "อ่านข้อมูล POS ไม่ได้" : "ยังไม่มีข้อมูล"}</p>}
        </div>
        <div className="rounded-xl border border-cream-200 bg-white p-4">
          <p className="text-sm text-ink-600">คะแนนที่ได้</p>
          <p className="text-2xl font-semibold text-ink-900">
            {kpi.points == null ? "—" : nf(kpi.points, 1)} <span className="text-base font-normal text-ink-400">/ {def.weight}</span>
          </p>
          <p className="text-xs text-ink-400">น้ำหนัก {def.weight}% ของคะแนนรวม</p>
        </div>
        <div className="rounded-xl border border-cream-200 bg-white p-4 sm:col-span-2">
          <p className="mb-1 text-sm text-ink-600">ระดับเป้าหมายของเดือน</p>
          {lvl ? (
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              {[
                { l: "น้อยสุด (0%)", v: lvl.min },
                { l: "ผ่าน (50%)", v: lvl.pass },
                { l: "ดีเยี่ยม (100%)", v: lvl.excellent },
                { l: "เกินเป้าหมาย (120%)", v: lvl.exceed },
              ].map((x) => (
                <div key={x.l} className="rounded-lg bg-cream-100 px-1 py-2">
                  <p className="text-sm font-semibold text-ink-900">{formatPlain(x.v, def.unit)}</p>
                  <p className="text-ink-500">{x.l}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-ink-400">เดือนนี้ยังไม่มีเป้าหมายในชีต (มีเฉพาะ ก.ค.–ธ.ค. 2569)</p>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>แนวโน้ม 6 เดือน</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <BarTrend width={900} items={trend.map((t) => ({ ...t, color: GREEN }))} format={(v) => formatPlain(v, def.unit)} />
          <Legend items={[{ color: GREEN, label: def.label }, { color: "#1f4d3a", label: "เป้าดีเยี่ยมของเดือน", dashed: true }]} />
        </CardContent>
      </Card>

      {(k === "OCC_RESORT" || k === "OCC_POOL_VILLA") && (
        <Card>
          <CardHeader>
            <CardTitle>OCC แยกรายห้อง ({k === "OCC_RESORT" ? "รีสอร์ท" : "พูลวิลล่า"})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ห้อง</TableHead>
                  <TableHead className="text-right">คืนที่มีแขกพัก</TableHead>
                  <TableHead className="w-1/2">OCC</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rooms.map((r) => (
                  <TableRow key={r.name}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-right">{r.occupiedNights}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 flex-1 rounded-full bg-cream-200">
                          <div className="h-full rounded-full bg-emerald-600" style={{ width: `${Math.min(100, r.rate)}%` }} />
                        </div>
                        <span className="w-14 text-right text-sm">{nf(r.rate, 1)}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {k === "BOOKINGS" && big && (
        <Card>
          <CardHeader>
            <CardTitle>งานจองที่ยอดเกิน 10,000 บาท ({big.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {big.length === 0 ? (
              <p className="py-4 text-center text-sm text-ink-400">ยังไม่มีงานจองที่ยอดเกิน 10,000 บาทในเดือนนี้</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>วันที่</TableHead>
                    <TableHead>ประเภท</TableHead>
                    <TableHead>ห้อง</TableHead>
                    <TableHead>ลูกค้า</TableHead>
                    <TableHead className="text-right">ยอดรวม</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {big.map((b) => (
                    <TableRow key={`${b.kind}-${b.id}`}>
                      <TableCell className="whitespace-nowrap text-sm">{b.date}</TableCell>
                      <TableCell className="text-sm text-ink-600">{b.kind === "BANQUET" ? "ห้องจัดเลี้ยง" : "ห้องพัก"}</TableCell>
                      <TableCell>
                        <Link href={b.kind === "BANQUET" ? `/banquet/${b.id}` : `/accommodation/${b.id}`} className="text-forest-700 hover:underline">
                          {b.place}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm">{b.customer}</TableCell>
                      <TableCell className="text-right text-sm font-medium">{nf(b.total)} บาท</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {needsPos && (
        <Card>
          <CardHeader>
            <CardTitle>
              {k === "BILLS_PER_DAY" ? "จำนวนบิลสวนอาหารรายวัน" : k === "BAHT_PER_BILL" ? "บาท/บิล รายวัน" : "ยอดขายอาหาร (POS) รายวัน"}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {pos && "error" in pos ? (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">อ่านข้อมูล POS ไม่ได้: {pos.error}</p>
            ) : daily.length === 0 ? (
              <p className="py-4 text-center text-sm text-ink-400">ไม่มียอดขายอาหารในเดือนนี้</p>
            ) : (
              <>
                <BarTrend
                  height={200}
                  width={Math.max(960, daily.length * 30)}
                  items={daily.map((d) => ({
                    label: String(Number(d.date.slice(8, 10))),
                    value: k === "BILLS_PER_DAY" ? d.bills : k === "BAHT_PER_BILL" ? (d.bills ? d.sales / d.bills : 0) : d.sales,
                    // The per-day target only applies to bills/day; the others are shown against nothing.
                    target: k === "BILLS_PER_DAY" ? (lvl?.excellent ?? null) : k === "BAHT_PER_BILL" ? (lvl?.excellent ?? null) : null,
                    color: GREEN,
                  }))}
                  format={(v) => (v >= 1000 ? `${nf(v / 1000, 1)}k` : nf(v))}
                />
                <p className="text-xs text-ink-500">
                  วันที่ในเดือน (แกนนอน) · {k === "TOTAL_SALES" ? "ยอดรวมของเดือนรวมห้องพักและงานจัดเลี้ยงจากระบบจองด้วย ดูสัดส่วนที่หน้าแรกของ KPI" : "เส้นประ = เป้าดีเยี่ยมของเดือน"}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
