import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { HOUSEKEEPING_STATUS_LABELS } from "@/lib/labels";
import { CLEANING_TYPE_LABELS, TRACKED_LABELS, trackedKeyForAddonName } from "@/lib/housekeeping";
import { formatShortThaiDate, formatThaiDate, shiftDate, toDateOnlyString, todayDateOnly } from "@/lib/dates";
import { ISSUE_LABELS, SEVERITY_LABELS, SEVERITY_ORDER, type IssueKind, type Severity } from "@/lib/housekeeping-reconcile";
import { loadReconciliation, syncAuditFindings } from "@/lib/housekeeping-audit";
import { FindingReview } from "@/components/housekeeping/FindingReview";
import { BookingLinks, type BookingInfo } from "@/components/audit/BookingLinks";

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
const MAX_RANGE_DAYS = 92;

function parseDay(v: string | undefined): Date | null {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; from?: string; to?: string; level?: string }>;
}) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "AUDITOR")) redirect("/dashboard");

  const { days, from: fromParam, to: toParam, level } = await searchParams;
  const showAll = level === "all";
  // The range is in ledger dates (the night a guest stayed). It ends at last night at the latest, because the
  // cleaning that proves a night is logged the next morning; ?days=N is kept for old links.
  const today = todayDateOnly();
  const yesterday = shiftDate(today, -1);
  const legacyDays = [7, 14, 30].includes(Number(days)) ? Number(days) : 7;
  let reqFrom = parseDay(fromParam) ?? shiftDate(today, -legacyDays);
  let reqTo = parseDay(toParam) ?? yesterday;
  if (reqFrom > reqTo) [reqFrom, reqTo] = [reqTo, reqFrom];
  if (reqTo > yesterday) reqTo = yesterday;
  if (reqFrom > reqTo) reqFrom = reqTo;
  if (reqFrom < shiftDate(reqTo, -(MAX_RANGE_DAYS - 1))) reqFrom = shiftDate(reqTo, -(MAX_RANGE_DAYS - 1));
  const { lastNight, firstNight, nights, stays, records, cancelByBooking, recon } = await loadReconciliation({ from: reqFrom, to: reqTo });
  const rangeDays = nights.length;
  const firstDay = firstNight;
  // Log timestamps are real instants; day buckets are Bangkok calendar days.
  const since = new Date(firstDay.getTime() - BANGKOK_OFFSET_MS);
  // The cleaning that proves night D happens on the morning of D+1, so status changes run a day or two past it.
  const until = new Date(shiftDate(lastNight, 2).getTime() - BANGKOK_OFFSET_MS);

  // Save what this check found before anything else can edit the bookings, then read back the saved findings.
  await syncAuditFindings(recon, nights);
  const [logs, findings] = await Promise.all([
    prisma.housekeepingLog.findMany({ where: { createdAt: { gte: since, lt: until } }, orderBy: { createdAt: "desc" }, take: 500 }),
    prisma.auditFinding.findMany({ where: { night: { gte: firstNight, lte: lastNight } }, orderBy: [{ night: "desc" }, { detectedAt: "desc" }] }),
  ]);

  const allIssues = recon.flatMap((n) => n.issues);
  const rank = (sev: Severity) => SEVERITY_ORDER.indexOf(sev);
  // Minor and informational items are only recomputed live; high/medium ones are the saved findings below.
  const minorIssues = allIssues
    .filter((i) => i.severity === "LOW" || i.severity === "INFO")
    .sort((a, b) => rank(a.severity) - rank(b.severity) || b.night.getTime() - a.night.getTime());
  // Cleared by the auditor = looked at and fine, so no longer counted against anyone.
  const counted = findings.filter((f) => f.status !== "CLEARED");
  const fSeverity = (f: { severity: string }) => f.severity as Severity;
  const sortedFindings = [...findings].sort(
    (a, b) =>
      Number(a.status !== "OPEN") - Number(b.status !== "OPEN") ||
      rank(fSeverity(a)) - rank(fSeverity(b)) ||
      b.night.getTime() - a.night.getTime()
  );
  const totals = {
    evidence: recon.reduce((s2, n) => s2 + n.evidence, 0),
    backed: recon.reduce((s2, n) => s2 + n.backed, 0),
    high: counted.filter((f) => f.severity === "HIGH").length,
    medium: counted.filter((f) => f.severity === "MEDIUM").length,
    open: findings.filter((f) => f.status === "OPEN").length,
    // A finding the data no longer reproduces (vanishedAt) was fixed after the fact, so it is not unpaid any more.
    atRisk: counted.filter((f) => !f.vanishedAt).reduce((s2, f) => s2 + Number(f.amount ?? 0), 0),
  };

  // ----- findings per staff member whose entry they trace back to -----
  type StaffRow = { name: string; high: number; medium: number; low: number; atRisk: number; cancelled: number; usedCancelled: number };
  const staff = new Map<string, StaffRow>();
  const row = (name: string) => {
    if (!staff.has(name)) staff.set(name, { name, high: 0, medium: 0, low: 0, atRisk: 0, cancelled: 0, usedCancelled: 0 });
    return staff.get(name)!;
  };
  for (const f of counted) {
    if (!f.responsible) continue;
    const r = row(f.responsible);
    if (f.severity === "HIGH") r.high++;
    else r.medium++;
    if (!f.vanishedAt) r.atRisk += Number(f.amount ?? 0);
    if (f.kind === "USED_CANCELLED") r.usedCancelled++;
  }
  for (const i of minorIssues) {
    if (i.responsible && i.severity === "LOW") row(i.responsible).low++;
  }
  for (const st of stays) {
    if (st.status !== "CANCELLED") continue;
    const who = cancelByBooking.get(st.id)?.cancelledBy?.name ?? st.createdBy?.name;
    if (who) row(who).cancelled++;
  }
  const staffRows = [...staff.values()].sort((a, b) => b.high - a.high || b.atRisk - a.atRisk || b.cancelled - a.cancelled);

  // ----- supplies taken out vs add-ons billed, per stay -----
  type Audit = { id: string; bookingId: string; room: string; customer: string; from: Date; to: Date; label: string; billed: number; taken: number };
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
      // A cleaning is logged under the night it cleans up after, and a stay's nights run from check-in through the day before check-out.
      if (r.resourceId !== st.resourceId || r.ledgerDate < st.checkIn || r.ledgerDate >= st.checkOut) continue;
      for (const i of r.items) if (i.category) taken.set(i.category, (taken.get(i.category) ?? 0) + i.quantity);
    }
    for (const key of new Set([...billed.keys(), ...taken.keys()])) {
      audits.push({
        id: `${st.id}-${key}`,
        bookingId: st.id,
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
    if (r.ledgerDate >= firstDay && r.ledgerDate <= lastNight) perUser.set(r.userName, (perUser.get(r.userName) ?? 0) + 1);
  }
  const recentRecords = records.filter((r) => r.ledgerDate >= firstDay && r.ledgerDate <= lastNight).slice(0, 300);

  // Which referenced bookings can still be opened, and the banquet bookings they are linked to.
  const referencedIds = [
    ...new Set([...findings.map((f) => f.bookingId), ...minorIssues.map((i) => i.bookingId), ...audits.map((a) => a.bookingId)].filter((x): x is string => !!x)),
  ];
  const bookingRows = referencedIds.length
    ? await prisma.accommodationBooking.findMany({
        where: { id: { in: referencedIds } },
        select: { id: true, linkedBanquetBookings: { select: { id: true, customerName: true, eventDate: true } } },
      })
    : [];
  const bookingInfo = new Map<string, BookingInfo>(bookingRows.map((b) => [b.id, { banquets: b.linkedBanquetBookings }]));

  const rangeHref = (f: Date, t: Date, all = showAll) =>
    `/audit?from=${toDateOnlyString(f)}&to=${toDateOnlyString(t)}${all ? "&level=all" : ""}`;
  const isSameRange = (f: Date, t: Date) => f.getTime() === firstNight.getTime() && t.getTime() === lastNight.getTime();
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const prevMonthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
  const prevMonthEnd = shiftDate(monthStart, -1);
  const presets = [
    { label: "เมื่อคืน", from: yesterday, to: yesterday },
    { label: "7 คืนล่าสุด", from: shiftDate(today, -7), to: yesterday },
    { label: "30 คืนล่าสุด", from: shiftDate(today, -30), to: yesterday },
    ...(monthStart <= yesterday ? [{ label: "เดือนนี้", from: monthStart, to: yesterday }] : []),
    { label: "เดือนที่แล้ว", from: prevMonthStart, to: prevMonthEnd },
  ];
  const chip = (active: boolean) =>
    cn(
      "rounded-full px-3 py-1.5 text-xs font-medium",
      active ? "bg-forest-700 text-cream-50" : "bg-cream-200 text-ink-600 hover:bg-cream-100"
    );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-forest-800">ตรวจสอบภายใน: หลักฐานการใช้ห้อง เทียบกับรายได้ที่บันทึก</h1>
        <p className="text-sm text-ink-400">
          ใช้บันทึกของแม่บ้านเป็นหลักฐานว่าห้องถูกใช้ แล้วตรวจว่าแคชเชียร์บันทึกการจอง การยกเลิก และการรับเงินครบหรือไม่ แม่บ้านแก้ไขบันทึกของตัวเองได้ ระบบเก็บชื่อผู้แก้ไขและเวลาไว้
        </p>
      </div>

      {/* Keyed by the range so the date boxes reset to it when a preset link changes the range (uncontrolled inputs
          otherwise keep what they showed, and "ดูรายการ" would re-submit those stale dates). */}
      <form key={`${toDateOnlyString(firstNight)}_${toDateOnlyString(lastNight)}_${showAll}`} method="get" action="/audit" className="flex flex-wrap items-end gap-2">
        {showAll && <input type="hidden" name="level" value="all" />}
        <label className="flex flex-col gap-1 text-xs text-ink-600">
          ตั้งแต่คืนวันที่
          <input type="date" name="from" defaultValue={toDateOnlyString(firstNight)} max={toDateOnlyString(yesterday)} className="h-9 rounded-md border border-cream-200 bg-white px-2 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-600">
          ถึงคืนวันที่
          <input type="date" name="to" defaultValue={toDateOnlyString(lastNight)} max={toDateOnlyString(yesterday)} className="h-9 rounded-md border border-cream-200 bg-white px-2 text-sm" />
        </label>
        <button type="submit" className="h-9 rounded-md bg-forest-700 px-4 text-sm font-medium text-cream-50 hover:bg-forest-600">
          ดูรายการ
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        {presets.map((pr) => (
          <Link key={pr.label} href={rangeHref(pr.from, pr.to)} className={chip(isSameRange(pr.from, pr.to))}>
            {pr.label}
          </Link>
        ))}
        <span className="mx-1 h-4 w-px bg-cream-200" />
        <Link href={rangeHref(firstNight, lastNight)} className={chip(!showAll)}>
          เฉพาะระดับสูง/กลาง
        </Link>
        <Link href={rangeHref(firstNight, lastNight, true)} className={chip(showAll)}>
          รวมรายการเล็กน้อย
        </Link>
        <span className="text-xs text-ink-400">
          ช่วง {formatThaiDate(firstNight)} – {formatThaiDate(lastNight)} ({rangeDays} คืน, ย้อนหลังได้สูงสุด {MAX_RANGE_DAYS} คืนต่อครั้ง)
        </span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            ห้องที่ถูกใช้จริง เทียบกับรายได้ที่บันทึก
            {totals.open > 0 && <span className="ml-2 text-sm font-semibold text-red-700">รอตรวจ {totals.open} รายการ</span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-xs text-ink-400">
            วันที่ลงบัญชี D คือคืนที่ลูกค้าพัก (ทำความสะอาดตอนเช้าวัน D+1) ถ้าแม่บ้านบันทึกห้องไหนในวัน D ถือว่าห้องนั้นถูกใช้คืนนั้น ต้องมีการจองที่ไม่ถูกยกเลิก และเมื่อพักเสร็จแล้วต้องมีบันทึกรับเงิน
            ระบบไม่เชื่อสถานะ &quot;จอง/เข้าพัก/เช็คเอาท์&quot; เพราะอาจไม่ได้อัปเดต สถานะค้างจึงเป็นแค่รายการเล็กน้อย
          </p>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
            {[
              { label: "ห้อง-คืนที่แม่บ้านบันทึกว่าใช้", value: totals.evidence },
              { label: "มีการจองรองรับ (ไม่ยกเลิก)", value: totals.backed },
              { label: "ระดับสูง (ไม่นับที่ตรวจว่าปกติ)", value: totals.high, bad: totals.high > 0 },
              { label: "รอผู้ตรวจ", value: totals.open, warn: totals.open > 0 },
              { label: "ระดับกลาง", value: totals.medium, warn: totals.medium > 0 },
              { label: "มูลค่าที่ยังไม่มีบันทึกรับเงิน (บาท)", value: baht(totals.atRisk), bad: totals.atRisk > 0 },
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

          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-forest-800">รายการที่ต้องตรวจ (ระดับสูง/กลาง) — บันทึกไว้ตั้งแต่ตรวจพบครั้งแรก</h3>
            <p className="text-xs text-ink-400">
              ระบบเก็บรายการไว้ แม้แคชเชียร์จะแก้ข้อมูลการจองหลังจากนั้น รายการที่แก้แล้วจะติดป้าย &quot;ข้อมูลถูกแก้ไขหลังตรวจพบ&quot; และยังต้องมีผู้ตรวจกดผลว่าปกติหรือผิดปกติพร้อมเหตุผล
            </p>
            {sortedFindings.length === 0 ? (
              <p className="text-sm text-emerald-700">ไม่พบรายการในช่วงนี้</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-cream-200 bg-white">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ผลตรวจ</TableHead>
                      <TableHead>ระดับ</TableHead>
                      <TableHead>วันที่ลงบัญชี</TableHead>
                      <TableHead>ห้อง</TableHead>
                      <TableHead>ปัญหา</TableHead>
                      <TableHead>รายละเอียด</TableHead>
                      <TableHead className="text-right">มูลค่า (บาท)</TableHead>
                      <TableHead>ผู้ลงข้อมูล</TableHead>
                      <TableHead>การจอง</TableHead>
                      <TableHead>บันทึกผล</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedFindings.map((f) => (
                      <TableRow key={f.id} className={cn(f.status === "CLEARED" && "opacity-60")}>
                        <TableCell className="min-w-32 text-xs">
                          {f.status === "OPEN" && <Badge variant="warning">รอตรวจ</Badge>}
                          {f.status === "CLEARED" && <Badge variant="success">ปกติ</Badge>}
                          {f.status === "CONFIRMED" && <Badge variant="danger">ยืนยันผิดปกติ</Badge>}
                          {f.status !== "OPEN" && (
                            <p className="mt-1 text-ink-600">
                              {f.reviewedByName} · {f.reviewedAt?.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short" })}
                              {f.note ? ` — ${f.note}` : ""}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={SEVERITY_BADGE[fSeverity(f)]}>{SEVERITY_LABELS[fSeverity(f)]}</Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">{formatShortThaiDate(f.night)}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm font-medium">{f.roomName}</TableCell>
                        <TableCell className={cn("min-w-48 text-sm", f.severity === "HIGH" && "font-medium text-red-700")}>
                          {ISSUE_LABELS[f.kind as IssueKind] ?? f.kind}
                        </TableCell>
                        <TableCell className="min-w-56 max-w-sm text-xs text-ink-600">
                          {f.detail ?? "-"}
                          <span className="mt-1 block text-ink-400">
                            ตรวจพบ {f.detectedAt.toLocaleString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short" })}
                          </span>
                          {f.vanishedAt && (
                            <span className="mt-1 block font-medium text-amber-700">
                              ข้อมูลถูกแก้ไขหลังตรวจพบ (ตรวจครั้งล่าสุดไม่พบแล้ว เมื่อ{" "}
                              {f.vanishedAt.toLocaleString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short" })})
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-sm">{f.amount ? baht(Number(f.amount)) : "-"}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm">{f.responsible ?? "-"}</TableCell>
                        <TableCell className="text-sm">
                          <BookingLinks bookingId={f.bookingId} customerName={f.customerName} info={f.bookingId ? bookingInfo.get(f.bookingId) : undefined} />
                        </TableCell>
                        <TableCell>
                          <FindingReview id={f.id} status={f.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          {showAll && minorIssues.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-forest-800">รายการเล็กน้อย / ข้อมูลทั่วไป (คำนวณสด ไม่ได้บันทึกไว้)</h3>
              <div className="overflow-x-auto rounded-lg border border-cream-200 bg-white">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ระดับ</TableHead>
                      <TableHead>วันที่ลงบัญชี</TableHead>
                      <TableHead>ห้อง</TableHead>
                      <TableHead>ปัญหา</TableHead>
                      <TableHead>การจอง</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {minorIssues.map((i, idx) => (
                      <TableRow key={`${i.kind}-${i.resourceId}-${toDateOnlyString(i.night)}-${idx}`}>
                        <TableCell>
                          <Badge variant={SEVERITY_BADGE[i.severity]}>{SEVERITY_LABELS[i.severity]}</Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">{formatShortThaiDate(i.night)}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm font-medium">{i.roomName}</TableCell>
                        <TableCell className="text-sm">{ISSUE_LABELS[i.kind]}</TableCell>
                        <TableCell className="text-sm">
                          <BookingLinks bookingId={i.bookingId} customerName={i.customerName} info={i.bookingId ? bookingInfo.get(i.bookingId) : undefined} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
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
                        <div className="font-medium">{a.room}</div>
                        <BookingLinks bookingId={a.bookingId} customerName={a.customer} info={bookingInfo.get(a.bookingId)} />
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
          <CardTitle>จำนวนครั้งที่ทำความสะอาด แยกตามผู้ทำ ({rangeDays} คืน)</CardTitle>
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
