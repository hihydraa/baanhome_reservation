import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { HOUSEKEEPING_STATUS_LABELS, PAYMENT_METHOD_LABELS } from "@/lib/labels";
import { CLEANING_TYPE_LABELS, TRACKED_LABELS, trackedKeyForAddonName } from "@/lib/housekeeping";
import { formatShortThaiDate, shiftDate, toDateOnlyString, todayDateOnly } from "@/lib/dates";
import { accommodationExpectedTotal, sumPaid } from "@/lib/payment-calc";
import { ISSUE_LABELS, SEVERITY_LABELS, SEVERITY_ORDER, reconcileNights, type Severity } from "@/lib/housekeeping-reconcile";

// Audit view — never serve a cached snapshot.
export const dynamic = "force-dynamic";

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

const SEVERITY_BADGE: Record<Severity, "danger" | "warning" | "muted" | "outline"> = {
  HIGH: "danger",
  MEDIUM: "warning",
  LOW: "muted",
  INFO: "outline",
};

const baht = (n: number) => n.toLocaleString("th-TH", { maximumFractionDigits: 0 });

/**
 * ADMIN and AUDITOR only. Housekeeping's log is treated as independent evidence that a room was used, and every
 * such room-night is checked against the cashier's records (booking, cancellation, payment). Also the history of
 * every housekeeping status change.
 */
export default async function HousekeepingLogPage({ searchParams }: { searchParams: Promise<{ days?: string; level?: string }> }) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "AUDITOR")) redirect("/dashboard");

  const { days, level } = await searchParams;
  const rangeDays = [7, 14, 30].includes(Number(days)) ? Number(days) : 7;
  const showAll = level === "all";
  const today = todayDateOnly();
  const firstDay = shiftDate(today, -(rangeDays - 1));
  // Nights being reconciled: the last `rangeDays` nights up to last night (whose cleaning is this morning's).
  const lastNight = shiftDate(today, -1);
  const firstNight = shiftDate(today, -rangeDays);
  // Log timestamps are real instants; day buckets are Bangkok calendar days.
  const since = new Date(firstDay.getTime() - BANGKOK_OFFSET_MS);

  const [logs, stays, records, rooms] = await Promise.all([
    prisma.housekeepingLog.findMany({ where: { createdAt: { gte: since } }, orderBy: { createdAt: "desc" }, take: 500 }),
    // Every booking that overlaps the range — cancelled ones included, since "cancelled" is exactly what a room
    // that was really used might be hidden behind.
    prisma.accommodationBooking.findMany({
      where: { checkIn: { lte: today }, checkOut: { gt: firstNight } },
      select: {
        id: true,
        status: true,
        resourceId: true,
        customerName: true,
        checkIn: true,
        checkOut: true,
        roomPrice: true,
        discountType: true,
        discountValue: true,
        updatedAt: true,
        createdBy: { select: { name: true } },
        resource: { select: { name: true, price: true } },
        addons: { select: { quantity: true, price: true, description: true, service: { select: { name: true } } } },
        payment: { select: { entries: { select: { amount: true, method: true } } } },
      },
      orderBy: { checkIn: "desc" },
    }),
    prisma.cleaningRecord.findMany({
      where: { OR: [{ serviceDate: { gte: shiftDate(firstNight, -30), lte: today } }, { ledgerDate: { gte: firstNight, lte: today } }] },
      orderBy: { createdAt: "desc" },
      include: { items: true },
    }),
    prisma.resource.findMany({ where: { type: "ACCOMMODATION" }, select: { id: true, price: true } }),
  ]);

  // Who cancelled each cancelled booking, when, and why (the booking row itself only keeps the status).
  const cancelledIds = stays.filter((st) => st.status === "CANCELLED").map((st) => st.id);
  const cancelLogs = cancelledIds.length
    ? await prisma.cancellationLog.findMany({
        where: { bookingType: "ACCOMMODATION", action: "CANCEL", bookingId: { in: cancelledIds } },
        orderBy: { cancelledAt: "desc" },
        select: { bookingId: true, cancelledAt: true, reason: true, cancelledBy: { select: { name: true } } },
      })
    : [];
  const cancelByBooking = new Map<string, (typeof cancelLogs)[number]>();
  for (const c of cancelLogs) if (!cancelByBooking.has(c.bookingId)) cancelByBooking.set(c.bookingId, c);

  // ----- room-night reconciliation: housekeeping evidence vs the cashier's bookings, cancellations, payments -----
  const nights = Array.from({ length: rangeDays }, (_, i) => shiftDate(lastNight, -i));
  const recon = reconcileNights({
    nights,
    today,
    resourceRates: Object.fromEntries(rooms.map((r) => [r.id, r.price ? Number(r.price) : 0])),
    bookings: stays.map((st) => {
      const entries = st.payment?.entries ?? [];
      const cancel = cancelByBooking.get(st.id);
      const cancelled = st.status === "CANCELLED";
      return {
        id: st.id,
        resourceId: st.resourceId,
        roomName: st.resource.name,
        customerName: st.customerName,
        checkIn: st.checkIn,
        checkOut: st.checkOut,
        status: st.status,
        roomRate: Number(st.roomPrice ?? st.resource.price ?? 0),
        expectedTotal: accommodationExpectedTotal(st, st.addons).expectedTotal,
        paid: sumPaid(entries),
        payMethods: [...new Set(entries.map((e) => PAYMENT_METHOD_LABELS[e.method] ?? e.method))],
        createdByName: st.createdBy?.name ?? null,
        // A booking cancelled with no log row (older data) falls back to its last edit time.
        cancelledAt: cancelled ? (cancel?.cancelledAt ?? st.updatedAt) : null,
        cancelledByName: cancelled ? (cancel?.cancelledBy?.name ?? null) : null,
        cancelReason: cancelled ? (cancel?.reason ?? null) : null,
      };
    }),
    records: records.map((r) => ({
      id: r.id,
      resourceId: r.resourceId,
      roomName: r.roomName,
      type: r.type,
      ledgerDate: r.ledgerDate,
      createdAt: r.createdAt,
    })),
  });

  const allIssues = recon.flatMap((n) => n.issues);
  const rank = (s: Severity) => SEVERITY_ORDER.indexOf(s);
  const shownIssues = allIssues
    .filter((i) => showAll || i.severity === "HIGH" || i.severity === "MEDIUM")
    .sort((a, b) => rank(a.severity) - rank(b.severity) || b.night.getTime() - a.night.getTime());
  const countBy = (s: Severity) => allIssues.filter((i) => i.severity === s).length;
  const totals = {
    evidence: recon.reduce((s2, n) => s2 + n.evidence, 0),
    backed: recon.reduce((s2, n) => s2 + n.backed, 0),
    checkouts: recon.reduce((s2, n) => s2 + n.checkouts, 0),
    cleaned: recon.reduce((s2, n) => s2 + n.checkoutCleaned, 0),
    stay: recon.reduce((s2, n) => s2 + n.stayCleans, 0),
    high: countBy("HIGH"),
    medium: countBy("MEDIUM"),
    low: countBy("LOW"),
    atRisk: allIssues.filter((i) => i.severity === "HIGH" || i.severity === "MEDIUM").reduce((s2, i) => s2 + (i.amount ?? 0), 0),
  };

  // ----- findings per staff member whose entry they trace back to -----
  type StaffRow = { name: string; high: number; medium: number; low: number; atRisk: number; cancelled: number; usedCancelled: number };
  const staff = new Map<string, StaffRow>();
  const row = (name: string) => {
    if (!staff.has(name)) staff.set(name, { name, high: 0, medium: 0, low: 0, atRisk: 0, cancelled: 0, usedCancelled: 0 });
    return staff.get(name)!;
  };
  for (const i of allIssues) {
    if (!i.responsible || i.severity === "INFO") continue;
    const r = row(i.responsible);
    if (i.severity === "HIGH") r.high++;
    else if (i.severity === "MEDIUM") r.medium++;
    else r.low++;
    if (i.severity === "HIGH" || i.severity === "MEDIUM") r.atRisk += i.amount ?? 0;
    if (i.kind === "USED_CANCELLED") r.usedCancelled++;
  }
  for (const st of stays) {
    if (st.status !== "CANCELLED") continue;
    const who = cancelByBooking.get(st.id)?.cancelledBy?.name ?? st.createdBy?.name;
    if (who) row(who).cancelled++;
  }
  const staffRows = [...staff.values()].sort((a, b) => b.high - a.high || b.atRisk - a.atRisk || b.cancelled - a.cancelled);

  // ----- supplies taken out vs add-ons billed, per stay -----
  type Audit = { id: string; room: string; customer: string; from: Date; to: Date; label: string; billed: number; taken: number };
  const audits: Audit[] = [];
  for (const st of stays) {
    if (st.status === "CANCELLED") continue;
    const billed = new Map<string, number>();
    for (const a of st.addons) {
      const key = trackedKeyForAddonName(a.service?.name ?? a.description);
      if (key) billed.set(key, (billed.get(key) ?? 0) + a.quantity);
    }
    const taken = new Map<string, number>();
    for (const r of records) {
      // The stay's nights run check-in day through the day before check-out.
      if (r.resourceId !== st.resourceId || r.serviceDate < st.checkIn || r.serviceDate >= st.checkOut) continue;
      for (const i of r.items) if (i.category) taken.set(i.category, (taken.get(i.category) ?? 0) + i.quantity);
    }
    for (const key of new Set([...billed.keys(), ...taken.keys()])) {
      audits.push({
        id: `${st.id}-${key}`,
        room: st.resource.name,
        customer: st.customerName,
        from: st.checkIn,
        to: st.checkOut,
        label: TRACKED_LABELS[key] ?? key,
        billed: billed.get(key) ?? 0,
        taken: taken.get(key) ?? 0,
      });
    }
  }
  const mismatches = audits.filter((a) => a.billed !== a.taken).length;

  const perUser = new Map<string, number>();
  for (const r of records) {
    if (r.serviceDate >= firstDay) perUser.set(r.userName, (perUser.get(r.userName) ?? 0) + 1);
  }
  const recentRecords = records.filter((r) => r.serviceDate >= firstDay).slice(0, 300);

  const chip = (active: boolean) =>
    cn(
      "rounded-full px-3 py-1.5 text-xs font-medium",
      active ? "bg-forest-700 text-cream-50" : "bg-cream-200 text-ink-600 hover:bg-cream-100"
    );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-forest-800">บันทึกการทำห้องของแม่บ้าน</h1>
        <p className="text-sm text-ink-400">
          ใช้บันทึกของแม่บ้านเป็นหลักฐานว่าห้องถูกใช้ แล้วตรวจว่าแคชเชียร์บันทึกการจอง การยกเลิก และการรับเงินครบหรือไม่ แก้ไขหรือลบบันทึกแม่บ้านไม่ได้
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {[7, 14, 30].map((d) => (
          <Link key={d} href={`/housekeeping-log?days=${d}${showAll ? "&level=all" : ""}`} className={chip(rangeDays === d)}>
            {d} วันล่าสุด
          </Link>
        ))}
        <span className="mx-1 h-4 w-px bg-cream-200" />
        <Link href={`/housekeeping-log?days=${rangeDays}`} className={chip(!showAll)}>
          เฉพาะระดับสูง/กลาง
        </Link>
        <Link href={`/housekeeping-log?days=${rangeDays}&level=all`} className={chip(showAll)}>
          รวมรายการเล็กน้อย
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            ห้องที่ถูกใช้จริง เทียบกับรายได้ที่บันทึก
            {totals.high > 0 && <span className="ml-2 text-sm font-semibold text-red-700">ระดับสูง {totals.high} รายการ</span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-xs text-ink-400">
            วันที่ลงบัญชี D คือคืนที่ลูกค้าพัก (ทำความสะอาดตอนเช้าวัน D+1) ถ้าแม่บ้านบันทึกห้องไหนในวัน D ถือว่าห้องนั้นถูกใช้คืนนั้น ต้องมีการจองที่ไม่ถูกยกเลิก และเมื่อพักเสร็จแล้วต้องมีบันทึกรับเงิน
            ระบบไม่เชื่อสถานะ &quot;จอง/เข้าพัก/เช็คเอาท์&quot; เพราะอาจไม่ได้อัปเดต สถานะค้างจึงเป็นแค่รายการเล็กน้อย
          </p>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              { label: "ห้อง-คืนที่แม่บ้านบันทึกว่าใช้", value: totals.evidence },
              { label: "มีการจองรองรับ (ไม่ยกเลิก)", value: totals.backed },
              { label: "ระดับสูง", value: totals.high, bad: totals.high > 0 },
              { label: "ระดับกลาง", value: totals.medium, warn: totals.medium > 0 },
              { label: "มูลค่าที่ไม่มีบันทึกรับเงิน (บาท)", value: baht(totals.atRisk), bad: totals.atRisk > 0 },
            ].map((c) => (
              <div key={c.label} className={cn("rounded-lg p-3 text-center", c.bad ? "bg-red-50" : c.warn ? "bg-amber-50" : "bg-cream-100")}>
                <p className={cn("text-2xl font-semibold", c.bad ? "text-red-700" : c.warn ? "text-amber-700" : "text-forest-800")}>{c.value}</p>
                <p className="text-xs text-ink-600">{c.label}</p>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto rounded-lg border border-cream-200 bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>วันที่ลงบัญชี</TableHead>
                  <TableHead className="text-right">แม่บ้านบันทึกว่าใช้</TableHead>
                  <TableHead className="text-right">มีการจองรองรับ</TableHead>
                  <TableHead className="text-right">เช็คเอาท์เช้าวันถัดไป</TableHead>
                  <TableHead className="text-right">ทำหลังเช็คเอาท์</TableHead>
                  <TableHead className="text-right">พักต่อ (ลูกค้าขอ)</TableHead>
                  <TableHead>ผลกระทบยอด</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recon.map((n) => {
                  const n2 = (s: Severity) => n.issues.filter((i) => i.severity === s).length;
                  const high = n2("HIGH");
                  const medium = n2("MEDIUM");
                  const low = n2("LOW");
                  const pending = n.issues.filter((i) => i.kind === "PENDING_CHECKOUT").length;
                  return (
                    <TableRow key={toDateOnlyString(n.night)}>
                      <TableCell className="whitespace-nowrap text-sm">{formatShortThaiDate(n.night)}</TableCell>
                      <TableCell className="text-right text-sm">{n.evidence}</TableCell>
                      <TableCell className="text-right text-sm">{n.backed}</TableCell>
                      <TableCell className="text-right text-sm">{n.checkouts}</TableCell>
                      <TableCell className="text-right text-sm">{n.checkoutCleaned}</TableCell>
                      <TableCell className="text-right text-sm">{n.stayCleans}</TableCell>
                      <TableCell className="text-sm">
                        {high + medium + low + pending === 0 ? (
                          <span className="text-emerald-700">ตรงกัน</span>
                        ) : (
                          <span className="flex flex-col gap-0.5">
                            {high > 0 && <span className="font-medium text-red-700">สูง {high} รายการ</span>}
                            {medium > 0 && <span className="font-medium text-amber-700">กลาง {medium} รายการ</span>}
                            {low > 0 && <span className="text-ink-600">เล็กน้อย {low} รายการ</span>}
                            {pending > 0 && <span className="text-ink-600">รอทำความสะอาด {pending} ห้อง</span>}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {shownIssues.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-cream-200 bg-white">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ระดับ</TableHead>
                    <TableHead>วันที่ลงบัญชี</TableHead>
                    <TableHead>ห้อง</TableHead>
                    <TableHead>ปัญหา</TableHead>
                    <TableHead>รายละเอียด</TableHead>
                    <TableHead className="text-right">มูลค่า (บาท)</TableHead>
                    <TableHead>ผู้ลงข้อมูล</TableHead>
                    <TableHead>การจอง</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shownIssues.map((i, idx) => (
                    <TableRow key={`${i.kind}-${i.resourceId}-${toDateOnlyString(i.night)}-${idx}`}>
                      <TableCell>
                        <Badge variant={SEVERITY_BADGE[i.severity]}>{SEVERITY_LABELS[i.severity]}</Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">{formatShortThaiDate(i.night)}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm font-medium">{i.roomName}</TableCell>
                      <TableCell className={cn("min-w-48 text-sm", i.severity === "HIGH" && "font-medium text-red-700")}>{ISSUE_LABELS[i.kind]}</TableCell>
                      <TableCell className="min-w-56 max-w-sm text-xs text-ink-600">{i.detail ?? "-"}</TableCell>
                      <TableCell className="text-right text-sm">{i.amount ? baht(i.amount) : "-"}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">{i.responsible ?? "-"}</TableCell>
                      <TableCell className="text-sm">
                        {i.bookingId ? (
                          <Link href={`/accommodation/${i.bookingId}`} className="text-forest-700 hover:underline">
                            {i.customerName}
                          </Link>
                        ) : (
                          <Link href="/housekeeping-daily" className="text-forest-700 hover:underline">
                            ดูบันทึกในบัญชีคุมฯ
                          </Link>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <p className="text-xs text-ink-400">
            ระบบเห็นเฉพาะห้องที่แม่บ้านมีบันทึก ห้องที่ถูกใช้แต่ไม่มีใครบันทึกจะไม่ถูกตรวจ มูลค่าคำนวณจากราคาห้องในการจอง (หรือราคาห้องตามรายการราคา ถ้าไม่มีการจอง)
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>สรุปตามผู้ลงข้อมูล (รายการที่ย้อนไปถึงพนักงานได้)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-xs text-ink-400">
            นับตามผู้สร้างการจอง และผู้ยกเลิกสำหรับกรณี &quot;ยกเลิกแต่ห้องถูกใช้&quot; ใช้ดูรูปแบบที่เกิดซ้ำกับคนเดิม รายการเดี่ยวอาจเป็นความผิดพลาดได้ ห้องที่ไม่มีการจองจะย้อนไปถึงใครไม่ได้
          </p>
          {staffRows.length === 0 ? (
            <p className="text-sm text-ink-400">ไม่พบรายการในช่วงนี้</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-cream-200 bg-white">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ชื่อ</TableHead>
                    <TableHead className="text-right">ระดับสูง</TableHead>
                    <TableHead className="text-right">ระดับกลาง</TableHead>
                    <TableHead className="text-right">เล็กน้อย</TableHead>
                    <TableHead className="text-right">ยกเลิกแล้วห้องถูกใช้</TableHead>
                    <TableHead className="text-right">ยกเลิกทั้งหมด</TableHead>
                    <TableHead className="text-right">มูลค่า (บาท)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staffRows.map((r) => (
                    <TableRow key={r.name}>
                      <TableCell className="text-sm font-medium">{r.name}</TableCell>
                      <TableCell className={cn("text-right text-sm", r.high > 0 && "font-medium text-red-700")}>{r.high}</TableCell>
                      <TableCell className="text-right text-sm">{r.medium}</TableCell>
                      <TableCell className="text-right text-sm">{r.low}</TableCell>
                      <TableCell className={cn("text-right text-sm", r.usedCancelled > 0 && "font-medium text-red-700")}>{r.usedCancelled}</TableCell>
                      <TableCell className="text-right text-sm">{r.cancelled}</TableCell>
                      <TableCell className="text-right text-sm">{r.atRisk ? baht(r.atRisk) : "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            ตรวจสอบของที่เบิก เทียบกับบริการเสริมที่เก็บเงิน (เตียงเสริม ผ้าห่ม หมอน สัตว์เลี้ยง)
            {mismatches > 0 && <span className="ml-2 text-sm font-semibold text-red-700">ไม่ตรง {mismatches} รายการ</span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-xs text-ink-400">
            นับของที่เบิกในห้องนั้นตั้งแต่วันเช็คอินจนถึงก่อนวันเช็คเอาท์ เทียบกับจำนวนบริการเสริมในการจอง แสดงเฉพาะรายการที่มีการเก็บเงินหรือมีการเบิก
          </p>
          {audits.length === 0 ? (
            <p className="text-sm text-ink-400">ไม่มีรายการในช่วงนี้</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-cream-200 bg-white">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ห้อง / ลูกค้า</TableHead>
                    <TableHead>เข้าพัก</TableHead>
                    <TableHead>รายการ</TableHead>
                    <TableHead className="text-right">เก็บเงินในการจอง</TableHead>
                    <TableHead className="text-right">แม่บ้านเบิก</TableHead>
                    <TableHead>ผลตรวจ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {audits.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="text-sm">
                        <span className="font-medium">{a.room}</span> · {a.customer}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {formatShortThaiDate(a.from)} – {formatShortThaiDate(a.to)}
                      </TableCell>
                      <TableCell className="text-sm">{a.label}</TableCell>
                      <TableCell className="text-right text-sm">{a.billed}</TableCell>
                      <TableCell className="text-right text-sm">{a.taken}</TableCell>
                      <TableCell className="text-sm">
                        {a.billed === a.taken ? (
                          <span className="text-emerald-700">ตรงกัน</span>
                        ) : a.taken > a.billed ? (
                          <span className="font-medium text-red-700">เบิกแต่ยังไม่ได้เก็บเงิน</span>
                        ) : (
                          <span className="font-medium text-amber-700">เก็บเงินแต่ไม่มีบันทึกเบิก</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>จำนวนครั้งที่ทำความสะอาด แยกตามผู้ทำ ({rangeDays} วันล่าสุด)</CardTitle>
        </CardHeader>
        <CardContent>
          {perUser.size === 0 ? (
            <p className="text-sm text-ink-400">ยังไม่มีบันทึกในช่วงนี้</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {[...perUser.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([name, count]) => (
                  <div key={name} className="rounded-lg border border-cream-200 bg-white px-3 py-2 text-sm">
                    <p className="font-medium text-ink-900">{name}</p>
                    <p className="text-xs text-ink-600">{count} ครั้ง</p>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>บันทึกการทำความสะอาดและของที่เบิก</CardTitle>
        </CardHeader>
        <CardContent>
          {recentRecords.length === 0 ? (
            <p className="text-sm text-ink-400">ยังไม่มีบันทึกในช่วงนี้</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-cream-200 bg-white">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>วันที่/เวลา</TableHead>
                    <TableHead>ห้อง</TableHead>
                    <TableHead>ประเภท</TableHead>
                    <TableHead>เบิก</TableHead>
                    <TableHead>หมายเหตุ</TableHead>
                    <TableHead>โดย</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentRecords.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {r.createdAt.toLocaleString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short" })}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm font-medium">{r.roomName}</TableCell>
                      <TableCell>
                        <Badge variant={r.type === "CHECKOUT" ? "gold" : "muted"}>{CLEANING_TYPE_LABELS[r.type]}</Badge>
                      </TableCell>
                      <TableCell className="min-w-48 text-sm">
                        {r.items.length === 0 ? "-" : r.items.map((i) => `${i.name} ×${i.quantity}`).join(", ")}
                      </TableCell>
                      <TableCell className="max-w-xs text-sm">{r.notes || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">{r.userName}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <h2 className="text-base font-semibold text-forest-800">ประวัติการเปลี่ยนสถานะห้อง</h2>
      {logs.length === 0 ? (
        <p className="rounded-lg border border-dashed border-cream-200 p-8 text-center text-sm text-ink-400">
          ไม่มีรายการในช่วงนี้
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-cream-200 bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>วันที่/เวลา</TableHead>
                <TableHead>ห้อง</TableHead>
                <TableHead>เปลี่ยนสถานะ</TableHead>
                <TableHead>โดย</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="whitespace-nowrap text-sm">
                    {l.createdAt.toLocaleString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short" })}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm font-medium">{l.roomName}</TableCell>
                  <TableCell className="text-sm">
                    <span className="text-ink-600">{HOUSEKEEPING_STATUS_LABELS[l.fromStatus]}</span>
                    {" → "}
                    <Badge variant={l.toStatus === "READY" ? "success" : l.toStatus === "OUT_OF_SERVICE" ? "danger" : "warning"}>{HOUSEKEEPING_STATUS_LABELS[l.toStatus]}</Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{l.userName}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
