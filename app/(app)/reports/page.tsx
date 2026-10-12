import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { RangeNav } from "@/components/reports/RangeNav";
import { ExportPanel } from "@/components/reports/ExportPanel";
import { currentMonthString } from "@/lib/reports";
import { loadPerformance, previousRange, resolveRange, type PerformanceReport } from "@/lib/performance";
import {
  ZONE_LABELS,
  SOURCE_LABELS,
  PAYMENT_METHOD_LABELS,
  BANQUET_EVENT_TYPE_LABELS,
  BOOKING_TYPE_LABELS,
} from "@/lib/labels";
import { formatThaiDate, parseDateOnly, toDateOnlyString, todayDateOnly } from "@/lib/dates";
import Link from "next/link";
import { DailyOccChart } from "@/components/reports/DailyOccChart";

const baht = (v: number) => v.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const pct = (v: number) => `${v.toFixed(1)}%`;

/** Change vs the previous equally long period: percentage points for rates, % change for money. */
function Delta({ now, prev, kind }: { now: number; prev: number; kind: "pp" | "pct" }) {
  if (prev === 0 && now === 0) return <span className="text-xs text-ink-400">เท่าเดิม</span>;
  const diff = kind === "pp" ? now - prev : prev === 0 ? null : ((now - prev) / prev) * 100;
  if (diff == null) return <span className="text-xs text-ink-400">ช่วงก่อนหน้า 0</span>;
  const up = diff >= 0;
  return (
    <span className={`text-xs font-medium ${up ? "text-emerald-700" : "text-red-700"}`}>
      {up ? "▲" : "▼"} {Math.abs(diff).toFixed(1)}
      {kind === "pp" ? " จุด" : "%"} <span className="font-normal text-ink-400">เทียบช่วงก่อนหน้า</span>
    </span>
  );
}

function Kpi({ title, value, sub, delta }: { title: string; value: string; sub?: string; delta?: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-ink-600">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        <p className="text-2xl font-bold text-forest-800">{value}</p>
        {sub && <p className="text-xs text-ink-400">{sub}</p>}
        {delta}
      </CardContent>
    </Card>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-forest-800">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-ink-600">{label}</span>
      <span className={strong ? "font-bold text-forest-800" : "font-semibold text-forest-800"}>{value}</span>
    </div>
  );
}

const th = "px-2 py-1.5 text-left text-xs font-medium text-ink-600";
const td = "px-2 py-1.5 text-sm";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; month?: string; from?: string; to?: string }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role === "HOUSEKEEPER") {
    redirect("/dashboard");
  }

  const { tab, ...rangeParams } = await searchParams;
  const tabValue = tab === "export" ? "export" : "overview";

  const { from, to } = resolveRange(rangeParams, currentMonthString());
  const prevRange = previousRange(from, to);
  const [r, prev] = await Promise.all([loadPerformance(from, to), loadPerformance(prevRange.from, prevRange.to)]);
  const todayStr = toDateOnlyString(todayDateOnly());
  const dayLabel = (date: string) => String(Number(date.slice(8)));
  const weekendDates = r.daily.map((d) => d.date).filter((d) => [0, 6].includes(parseDateOnly(d).getUTCDay()));
  const accRoomCount = r.accommodationOcc.byRoom.length;
  const accPoints = r.daily.map((d) => ({
    date: d.date,
    label: dayLabel(d.date),
    value: d.accRate,
    detail: `${d.accOccupied} / ${accRoomCount} ห้อง`,
  }));
  const zonePoints = (zone: string) =>
    r.daily.map((d) => {
      const z = d.zones.find((x) => x.zone === zone);
      return {
        date: d.date,
        label: dayLabel(d.date),
        value: z?.rate ?? 0,
        detail: `${z?.occupied ?? 0} / ${z?.rooms ?? 0} ห้อง`,
      };
    });
  const banquetPoints = r.daily.map((d) => ({
    date: d.date,
    label: dayLabel(d.date),
    value: d.banquetRate,
    detail: `${d.banquetUsed} / ${r.banquetOcc.roomCount} ห้องมีงาน`,
  }));
  const rangeLabel = `${formatThaiDate(parseDateOnly(from))} – ${formatThaiDate(parseDateOnly(to))} (${r.days} วัน)`;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-forest-800">รายงาน</h1>
        <p className="text-sm text-ink-600">สรุปภาพรวมสำหรับผู้บริหาร และส่งออกข้อมูลการจอง</p>
      </div>

      <Tabs defaultValue={tabValue}>
        <TabsList>
          <TabsTrigger value="overview">สรุปภาพรวม</TabsTrigger>
          <TabsTrigger value="export">ส่งออกข้อมูล</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="flex flex-col gap-8">
          <RangeNav from={from} to={to} today={todayStr} />
          <p className="-mt-4 text-xs text-ink-400">
            ช่วงที่แสดง: {rangeLabel} · เทียบกับ {formatThaiDate(parseDateOnly(prevRange.from))} – {formatThaiDate(parseDateOnly(prevRange.to))}
          </p>

          <Kpis r={r} prev={prev} />

          <Section title="อัตราการเข้าพัก (OCC. Rate) ห้องพัก">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {r.accommodationOcc.byZone.map((z) => (
                <Card key={z.zone}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">OCC. Rate — {ZONE_LABELS[z.zone] ?? z.zone}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-gold-600">{pct(z.rate)}</p>
                    <p className="mt-1 text-sm text-ink-400">
                      {z.occupiedNights.toLocaleString("th-TH")} / {z.capacityNights.toLocaleString("th-TH")} คืน ({z.roomCount} ห้อง)
                    </p>
                  </CardContent>
                </Card>
              ))}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">ราคาห้องและรายได้ห้องพัก</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-1">
                  <Row label="ADR (ราคาเฉลี่ย/คืน)" value={`${baht(r.accommodationOcc.adr)} บาท`} />
                  <Row label="RevPAR (รายได้/ห้องว่างทั้งหมด)" value={`${baht(r.accommodationOcc.revpar)} บาท`} />
                  <Row label="รายได้ค่าห้องตามคืนที่พัก" value={`${baht(r.accommodationOcc.roomRevenue)} บาท`} />
                  <p className="mt-1 text-xs text-ink-400">ADR ไม่นับคืนที่ราคาห้อง 0 บาท (เช่น Agoda)</p>
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardContent className="flex flex-col gap-6 pt-4">
                <DailyOccChart title="OCC. รายวัน — ห้องพัก (ทุกโซน)" points={accPoints} color="#ad8620" weekendDates={weekendDates} />
                {r.accommodationOcc.byZone.map((z) => (
                  <DailyOccChart
                    key={z.zone}
                    title={`OCC. รายวัน — ${ZONE_LABELS[z.zone] ?? z.zone} (${z.roomCount} ห้อง)`}
                    points={zonePoints(z.zone)}
                    color="#ad8620"
                    weekendDates={weekendDates}
                  />
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="overflow-x-auto pt-4">
                <table className="w-full min-w-[28rem]">
                  <thead>
                    <tr>
                      <th className={th}>ห้อง</th>
                      <th className={th}>โซน</th>
                      <th className={`${th} text-right`}>คืนที่มีผู้เข้าพัก</th>
                      <th className={`${th} text-right`}>OCC.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.accommodationOcc.byRoom.map((room) => (
                      <tr key={room.name} className="border-t border-cream-200">
                        <td className={td}>{room.name}</td>
                        <td className={td}>{ZONE_LABELS[room.zone] ?? room.zone}</td>
                        <td className={`${td} text-right`}>{room.occupiedNights}</td>
                        <td className={`${td} text-right font-semibold`}>{pct(room.rate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </Section>

          <Section title="อัตราการใช้ห้องจัดเลี้ยง (OCC. Rate)">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Kpi
                title="OCC. ห้องจัดเลี้ยง"
                value={pct(r.banquetOcc.rate)}
                sub={`${r.banquetOcc.usedSlots} / ${r.banquetOcc.capacitySlots} งาน (${r.banquetOcc.roomCount} ห้อง × ${r.days} วัน)`}
              />
              <Kpi
                title="จำนวนงาน / ชั่วโมงที่จอง"
                value={`${r.bookingCounts.banquet} งาน`}
                sub={`รวม ${r.banquetOcc.bookedHours.toLocaleString("th-TH")} ชม. · ยกเลิก ${r.cancellations.banquet.cancelled} งาน`}
              />
              <Kpi
                title="รายได้ต่องาน (เฉลี่ย)"
                value={`${baht(r.bookingCounts.banquet > 0 ? r.revenue.banquet / r.bookingCounts.banquet : 0)} บาท`}
                sub="หลังส่วนลด รวม VAT"
              />
            </div>
            <Card>
              <CardContent className="pt-4">
                <DailyOccChart title="OCC. รายวัน — ห้องจัดเลี้ยง" points={banquetPoints} color="#2a7350" weekendDates={weekendDates} />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="overflow-x-auto pt-4">
                <table className="w-full min-w-[28rem]">
                  <thead>
                    <tr>
                      <th className={th}>ห้อง</th>
                      <th className={`${th} text-right`}>วันที่มีงาน</th>
                      <th className={`${th} text-right`}>จำนวนงาน</th>
                      <th className={`${th} text-right`}>ชั่วโมง</th>
                      <th className={`${th} text-right`}>OCC.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.banquetOcc.byRoom.map((room) => (
                      <tr key={room.name} className="border-t border-cream-200">
                        <td className={td}>{room.name}</td>
                        <td className={`${td} text-right`}>{room.usedDays}</td>
                        <td className={`${td} text-right`}>{room.events}</td>
                        <td className={`${td} text-right`}>{room.hours.toLocaleString("th-TH")}</td>
                        <td className={`${td} text-right font-semibold`}>{pct(room.rate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {r.banquetOcc.byEventType.length > 0 && (
                  <div className="mt-4 flex flex-col gap-1 border-t border-cream-200 pt-3">
                    <p className="text-xs font-medium text-ink-600">แยกตามประเภทงาน</p>
                    {r.banquetOcc.byEventType.map((t) => (
                      <Row
                        key={t.type}
                        label={`${BANQUET_EVENT_TYPE_LABELS[t.type] ?? t.type} (${t.events} งาน)`}
                        value={`${baht(t.revenue)} บาท`}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </Section>

          <Section title="รายได้ (แสดงทั้ง 2 มุมมอง)">
            <p className="-mt-1 text-xs text-ink-400">หลักการ: รายได้ห้องพัก/พูลวิลล่า รับรู้ตามคืนที่เข้าพักจริง (ทุกช่องทางการจอง) ห้องจัดเลี้ยงรับรู้ตามวันที่จัดงาน ไม่ยึดวันที่รับเงิน และใช้ยอดสุทธิหลังส่วนลด · ยังไม่รวมรายได้ร้านอาหาร</p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">ตามวันที่ให้บริการจริง (รับรู้รายได้)</CardTitle>
                  <p className="text-xs text-ink-400">
                    ห้องพักแบ่งตามคืนที่พัก (ยอดสุทธิของการจองเฉลี่ยตามจำนวนคืน) · จัดเลี้ยงตามวันจัดงาน · ไม่รวมการจองที่ยกเลิก · รวม VAT
                  </p>
                </CardHeader>
                <CardContent className="flex flex-col gap-1.5">
                  <Row label="ห้องพัก/พูลวิลล่า (รับรู้แล้ว)" value={`${baht(r.revenue.recognized.accommodation)} บาท`} />
                  <Row label="ห้องจัดเลี้ยง (รับรู้แล้ว)" value={`${baht(r.revenue.recognized.banquet)} บาท`} />
                  <Row label="รายได้ที่รับรู้แล้ว (ถึงวันนี้)" value={`${baht(r.revenue.recognized.total)} บาท`} strong />
                  <Row label="มูลค่าก่อนภาษี" value={`${baht(r.revenue.exVat)} บาท`} />
                  <Row label="VAT 7% (รวมอยู่แล้ว)" value={`${baht(r.revenue.vat)} บาท`} />
                  <div className="my-1 border-t border-cream-200" />
                  <Row label="จองไว้ ยังไม่ถึงวันให้บริการ" value={`${baht(r.revenue.upcoming.total)} บาท`} />
                  <Row label="รวมรายได้ของช่วงนี้ (รับรู้แล้ว + จองไว้)" value={`${baht(r.revenue.net)} บาท`} strong />
                  <div className="my-1 border-t border-cream-200" />
                  <Row label="ยอดก่อนส่วนลด" value={`${baht(r.revenue.gross)} บาท`} />
                  <Row label="ส่วนลดที่กิจการรับผิดชอบ" value={`-${baht(r.revenue.discount)} บาท`} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">ตามวันที่รับเงินจริง (กระแสเงินสด)</CardTitle>
                  <p className="text-xs text-ink-400">เงินที่บันทึกรับในช่วงนี้ ไม่ว่าจะเป็นการจองของช่วงใด</p>
                </CardHeader>
                <CardContent className="flex flex-col gap-1.5">
                  <Row label="ห้องพัก" value={`${baht(r.cash.accommodation)} บาท`} />
                  <Row label="ห้องจัดเลี้ยง" value={`${baht(r.cash.banquet)} บาท`} />
                  <div className="my-1 border-t border-cream-200" />
                  <Row label="รับเงินรวม" value={`${baht(r.cash.total)} บาท`} strong />
                  {r.cash.byMethod.map((m) => (
                    <Row key={m.method} label={PAYMENT_METHOD_LABELS[m.method] ?? m.method} value={`${baht(m.amount)} บาท`} />
                  ))}
                </CardContent>
              </Card>
            </div>
          </Section>

          <Section title="การเก็บเงินและมัดจำ">
            <p className="-mt-1 text-xs text-ink-400">คิดตามการจองที่เช็คอิน/จัดงานในช่วงนี้ (ยอดรวมต่อการจอง ไม่แบ่งตามคืน)</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Kpi
                title="เก็บเงินแล้ว / ยอดที่ต้องเก็บ"
                value={pct(r.collection.paidRate)}
                sub={`${baht(r.collection.paid)} / ${baht(r.collection.expected)} บาท`}
              />
              <Kpi
                title="การจองที่มีมัดจำ/ชำระแล้ว"
                value={`${r.collection.withPayment} / ${r.collection.bookings}`}
                sub={`ยังไม่มีการชำระเลย ${r.collection.withoutPayment} รายการ`}
              />
              <Kpi
                title="มัดจำของงานที่ยังไม่ถึงวัน"
                value={pct(r.collection.upcomingBookings > 0 ? (r.collection.upcomingWithDeposit / r.collection.upcomingBookings) * 100 : 0)}
                sub={`${r.collection.upcomingWithDeposit} / ${r.collection.upcomingBookings} รายการมีมัดจำ · เก็บแล้ว ${baht(r.collection.upcomingPaid)} จาก ${baht(r.collection.upcomingExpected)} บาท`}
              />
            </div>
            {r.cancelledDeposits.count > 0 && (
              <Card>
                <CardContent className="pt-4 text-sm">
                  <p className="font-semibold text-forest-800">
                    เงินที่รับไว้จากการจองที่ยกเลิก: {baht(r.cancelledDeposits.amount)} บาท ({r.cancelledDeposits.count} รายการ)
                  </p>
                  <p className="text-xs text-ink-400">
                    ยังไม่นับเป็นรายได้ — ต้องพิจารณาตามเงื่อนไขการจอง การคืนเงิน และสิทธิเรียกเก็บค่าธรรมเนียมยกเลิกเป็นรายการ
                  </p>
                </CardContent>
              </Card>
            )}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">ยอดค้างชำระ (ใช้บริการแล้วแต่ยังเก็บไม่ครบ) — รวม {baht(r.receivablesTotal)} บาท</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                {r.receivables.length === 0 ? (
                  <p className="text-sm text-ink-400">ไม่มียอดค้างชำระ</p>
                ) : (
                  <table className="w-full min-w-[32rem]">
                    <thead>
                      <tr>
                        <th className={th}>ลูกค้า</th>
                        <th className={th}>ประเภท</th>
                        <th className={th}>วันที่</th>
                        <th className={`${th} text-right`}>ยอดรวม</th>
                        <th className={`${th} text-right`}>ชำระแล้ว</th>
                        <th className={`${th} text-right`}>ค้างชำระ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.receivables.map((x) => (
                        <tr key={`${x.type}-${x.id}`} className="border-t border-cream-200">
                          <td className={td}>
                            <Link
                              href={x.type === "BANQUET" ? `/banquet/${x.id}` : `/accommodation/${x.id}`}
                              className="text-forest-700 hover:underline"
                            >
                              {x.customerName}
                            </Link>
                          </td>
                          <td className={td}>{BOOKING_TYPE_LABELS[x.type]}</td>
                          <td className={td}>{formatThaiDate(parseDateOnly(x.date))}</td>
                          <td className={`${td} text-right`}>{baht(x.expected)}</td>
                          <td className={`${td} text-right`}>{baht(x.paid)}</td>
                          <td className={`${td} text-right font-semibold text-red-700`}>{baht(x.remaining)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </Section>

          <Section title="บริการเสริม">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Kpi
                title="รายได้บริการเสริมรวม"
                value={`${baht(r.addons.total)} บาท`}
                sub={`${pct(r.addons.shareOfGross)} ของยอดขายก่อนส่วนลด`}
              />
              <Kpi
                title="สัดส่วนการจองที่ซื้อบริการเสริม"
                value={pct(r.addons.attachRate)}
                sub={`${r.addons.bookingsWithAddons} / ${r.addons.bookings} รายการ`}
              />
              <Kpi
                title="แยกตามประเภทการจอง"
                value={`${baht(r.addons.byScope.accommodation + r.addons.byScope.banquet)} บาท`}
                sub={`ห้องพัก ${baht(r.addons.byScope.accommodation)} · จัดเลี้ยง ${baht(r.addons.byScope.banquet)}`}
              />
            </div>
            <Card>
              <CardContent className="overflow-x-auto pt-4">
                {r.addons.items.length === 0 ? (
                  <p className="text-sm text-ink-400">ไม่มีบริการเสริมในช่วงนี้</p>
                ) : (
                  <table className="w-full min-w-[28rem]">
                    <thead>
                      <tr>
                        <th className={th}>รายการ</th>
                        <th className={th}>ประเภท</th>
                        <th className={`${th} text-right`}>จำนวน</th>
                        <th className={`${th} text-right`}>จำนวนการจอง</th>
                        <th className={`${th} text-right`}>รายได้ (บาท)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.addons.items.map((it) => (
                        <tr key={it.name} className="border-t border-cream-200">
                          <td className={td}>{it.name}</td>
                          <td className={td}>{it.scope === "BOTH" ? "ทั้งสอง" : BOOKING_TYPE_LABELS[it.scope]}</td>
                          <td className={`${td} text-right`}>{it.quantity.toLocaleString("th-TH")}</td>
                          <td className={`${td} text-right`}>{it.bookings}</td>
                          <td className={`${td} text-right font-semibold`}>{baht(it.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </Section>

          <Section title="Top ลูกค้า">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              <Kpi title="ลูกค้าในช่วงนี้" value={`${r.customers.unique} ราย`} sub="นับตามชื่อลูกค้า" />
              <Kpi
                title="ลูกค้าเก่า / ลูกค้าใหม่"
                value={`${r.customers.returning} / ${r.customers.newCustomers}`}
                sub="เก่า = เคยจองก่อนช่วงนี้"
              />
              <Kpi title="ลูกค้าที่จองซ้ำในช่วงนี้" value={`${r.customers.repeat} ราย`} sub="จอง 2 ครั้งขึ้นไป" />
              <Kpi
                title="รายได้จาก Top 10"
                value={pct(r.customers.topShare)}
                sub="ของยอดสุทธิ (ยิ่งสูงยิ่งพึ่งลูกค้าไม่กี่ราย)"
              />
            </div>
            <Card>
              <CardContent className="overflow-x-auto pt-4">
                {r.customers.top.length === 0 ? (
                  <p className="text-sm text-ink-400">ไม่มีข้อมูลลูกค้าในช่วงนี้</p>
                ) : (
                  <table className="w-full min-w-[40rem]">
                    <thead>
                      <tr>
                        <th className={th}>#</th>
                        <th className={th}>ลูกค้า</th>
                        <th className={`${th} text-right`}>ห้องพัก</th>
                        <th className={`${th} text-right`}>คืน</th>
                        <th className={`${th} text-right`}>จัดเลี้ยง</th>
                        <th className={`${th} text-right`}>ยอดรวม (บาท)</th>
                        <th className={`${th} text-right`}>% ของรายได้</th>
                        <th className={`${th} text-right`}>ค้างชำระ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.customers.top.map((c, i) => (
                        <tr key={c.name} className="border-t border-cream-200">
                          <td className={td}>{i + 1}</td>
                          <td className={td}>
                            {c.name}
                            {c.returning && <span className="ml-1.5 rounded bg-gold-100 px-1.5 py-0.5 text-xs text-forest-800">ลูกค้าเก่า</span>}
                          </td>
                          <td className={`${td} text-right`}>{c.accommodation}</td>
                          <td className={`${td} text-right`}>{c.nights}</td>
                          <td className={`${td} text-right`}>{c.banquet}</td>
                          <td className={`${td} text-right font-semibold`}>{baht(c.revenue)}</td>
                          <td className={`${td} text-right`}>{pct(c.share)}</td>
                          <td className={`${td} text-right ${c.remaining > 0 ? "font-semibold text-red-700" : "text-ink-400"}`}>
                            {c.remaining > 0 ? baht(c.remaining) : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </Section>

          <Section title="ส่วนลด การยกเลิก และช่องทางการจอง">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">ส่วนลดที่ให้</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-1.5">
                  <Row label="รวม" value={`${baht(r.discounts.total)} บาท`} strong />
                  <Row label="คิดเป็น % ของยอดขาย" value={pct(r.revenue.gross > 0 ? (r.discounts.total / r.revenue.gross) * 100 : 0)} />
                  <Row label="จำนวนการจองที่ได้ส่วนลด" value={r.discounts.bookingsWithDiscount} />
                  {r.discounts.byNote.slice(0, 5).map((d) => (
                    <Row key={d.note} label={`${d.note} (${d.count})`} value={`${baht(d.amount)} บาท`} />
                  ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">อัตราการยกเลิก</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-1.5">
                  <Row
                    label="ห้องพัก"
                    value={`${pct(r.cancellations.accommodation.rate)} (${r.cancellations.accommodation.cancelled}/${r.cancellations.accommodation.total})`}
                  />
                  <Row
                    label="ห้องจัดเลี้ยง"
                    value={`${pct(r.cancellations.banquet.rate)} (${r.cancellations.banquet.cancelled}/${r.cancellations.banquet.total})`}
                  />
                  <p className="mt-1 text-xs text-ink-400">การจองเหมาโซนนับเป็น 1 รายการ</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">ช่องทางการจองห้องพัก</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-1.5">
                  {r.channels.length === 0 ? (
                    <p className="text-sm text-ink-400">ไม่มีข้อมูลการจองในช่วงนี้</p>
                  ) : (
                    r.channels.map((c) => (
                      <Row
                        key={c.source}
                        label={`${SOURCE_LABELS[c.source] ?? c.source} (${c.bookings} รายการ)`}
                        value={`${baht(c.revenue)} บาท`}
                      />
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </Section>
        </TabsContent>

        <TabsContent value="export">
          <ExportPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Kpis({ r, prev }: { r: PerformanceReport; prev: PerformanceReport }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Kpi
        title="OCC. ห้องพัก"
        value={pct(r.accommodationOcc.rate)}
        sub={`${r.accommodationOcc.occupiedNights.toLocaleString("th-TH")} / ${r.accommodationOcc.capacityNights.toLocaleString("th-TH")} คืน`}
        delta={<Delta now={r.accommodationOcc.rate} prev={prev.accommodationOcc.rate} kind="pp" />}
      />
      <Kpi
        title="OCC. ห้องจัดเลี้ยง"
        value={pct(r.banquetOcc.rate)}
        sub={`${r.banquetOcc.usedSlots} / ${r.banquetOcc.capacitySlots} งาน`}
        delta={<Delta now={r.banquetOcc.rate} prev={prev.banquetOcc.rate} kind="pp" />}
      />
      <Kpi
        title="รายได้ที่รับรู้แล้ว"
        value={`${baht(r.revenue.recognized.total)} บาท`}
        sub={`ตามคืน/วันที่ให้บริการจริง · จองไว้อีก ${baht(r.revenue.upcoming.total)} บาท`}
        delta={<Delta now={r.revenue.recognized.total} prev={prev.revenue.recognized.total} kind="pct" />}
      />
      <Kpi
        title="รายได้ที่รับเงินแล้ว"
        value={`${baht(r.cash.total)} บาท`}
        sub="ตามวันที่รับเงินจริง"
        delta={<Delta now={r.cash.total} prev={prev.cash.total} kind="pct" />}
      />
      <Kpi
        title="คาดการณ์รายได้ที่ยังไม่ได้รับ"
        value={`${baht(Math.max(0, r.collection.expected - r.collection.paid))} บาท`}
        sub={`จากยอดที่ต้องเก็บ ${baht(r.collection.expected)} บาท`}
      />
      <Kpi title="% การเก็บเงิน/มัดจำ" value={pct(r.collection.paidRate)} sub={`${r.collection.withPayment} / ${r.collection.bookings} รายการมีการชำระ`} />
      <Kpi
        title="ADR (ราคาห้องเฉลี่ย/คืน)"
        value={`${baht(r.accommodationOcc.adr)} บาท`}
        delta={<Delta now={r.accommodationOcc.adr} prev={prev.accommodationOcc.adr} kind="pct" />}
      />
      <Kpi
        title="RevPAR"
        value={`${baht(r.accommodationOcc.revpar)} บาท`}
        sub="รายได้ห้องพักต่อห้องว่างทั้งหมด"
        delta={<Delta now={r.accommodationOcc.revpar} prev={prev.accommodationOcc.revpar} kind="pct" />}
      />
    </div>
  );
}
