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
import { formatShortThaiDate, shiftDate, toDateOnlyString, todayDateOnly } from "@/lib/dates";
import { BLOCKING_KINDS, ISSUE_LABELS, reconcileNights } from "@/lib/housekeeping-checkout-recon";

// Audit view — never serve a cached snapshot.
export const dynamic = "force-dynamic";

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

/**
 * ADMIN only: the history of every housekeeping status change, plus a per-day check of
 * rooms that checked out against rooms housekeeping marked ready ("พร้อมขาย") that day.
 */
export default async function HousekeepingLogPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/dashboard");

  const { days } = await searchParams;
  const rangeDays = [7, 14, 30].includes(Number(days)) ? Number(days) : 7;
  const today = todayDateOnly();
  const firstDay = shiftDate(today, -(rangeDays - 1));
  // Nights being reconciled: the last `rangeDays` nights up to last night (whose cleaning is this morning's).
  const lastNight = shiftDate(today, -1);
  const firstNight = shiftDate(today, -rangeDays);
  // Log timestamps are real instants; day buckets are Bangkok calendar days.
  const since = new Date(firstDay.getTime() - BANGKOK_OFFSET_MS);

  const [logs, stays, records] = await Promise.all([
    prisma.housekeepingLog.findMany({ where: { createdAt: { gte: since } }, orderBy: { createdAt: "desc" }, take: 500 }),
    // Every stay that overlaps the range — used to audit supplies against billed add-ons.
    prisma.accommodationBooking.findMany({
      where: { checkIn: { lte: today }, checkOut: { gt: firstNight }, status: { not: "CANCELLED" } },
      select: {
        id: true,
        status: true,
        resourceId: true,
        customerName: true,
        checkIn: true,
        checkOut: true,
        resource: { select: { name: true } },
        addons: { select: { quantity: true, description: true, service: { select: { name: true } } } },
      },
      orderBy: { checkIn: "desc" },
    }),
    prisma.cleaningRecord.findMany({
      where: { OR: [{ serviceDate: { gte: shiftDate(firstNight, -30), lte: today } }, { ledgerDate: { gte: firstNight, lte: today } }] },
      orderBy: { createdAt: "desc" },
      include: { items: true },
    }),
  ]);

  // ----- room-night reconciliation: bookings vs cleaning records (by ledger date) -----
  const nights = Array.from({ length: rangeDays }, (_, i) => shiftDate(lastNight, -i));
  const recon = reconcileNights({
    nights,
    today,
    bookings: stays.map((st) => ({
      id: st.id,
      resourceId: st.resourceId,
      roomName: st.resource.name,
      customerName: st.customerName,
      checkIn: st.checkIn,
      checkOut: st.checkOut,
      status: st.status,
    })),
    records: records.map((r) => ({ id: r.id, resourceId: r.resourceId, roomName: r.roomName, type: r.type, ledgerDate: r.ledgerDate })),
  });
  const blocking = new Set<string>(BLOCKING_KINDS);
  const allIssues = recon.flatMap((n) => n.issues);
  const totals = {
    occupied: recon.reduce((s2, n) => s2 + n.occupied, 0),
    checkouts: recon.reduce((s2, n) => s2 + n.checkouts, 0),
    cleaned: recon.reduce((s2, n) => s2 + n.checkoutCleaned, 0),
    stay: recon.reduce((s2, n) => s2 + n.stayCleans, 0),
    problems: allIssues.filter((i) => blocking.has(i.kind)).length,
  };

  // ----- supplies taken out vs add-ons billed, per stay -----
  type Audit = { id: string; room: string; customer: string; from: Date; to: Date; label: string; billed: number; taken: number };
  const audits: Audit[] = [];
  for (const st of stays) {
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
          บันทึกการทำความสะอาดห้องและของที่แม่บ้านเบิก เพื่อทวนสอบกับการเช็คเอาท์และบริการเสริมในการจอง แก้ไขหรือลบไม่ได้
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {[7, 14, 30].map((d) => (
          <Link key={d} href={`/housekeeping-log?days=${d}`} className={chip(rangeDays === d)}>
            {d} วันล่าสุด
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            กระทบยอดห้อง: การจอง เทียบกับการทำความสะอาด (ตามวันที่ลงบัญชี)
            {totals.problems > 0 && <span className="ml-2 text-sm font-semibold text-red-700">ผิดปกติ {totals.problems} รายการ</span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-xs text-ink-400">
            วันที่ลงบัญชี D คือคืนที่ลูกค้าพัก (ทำความสะอาดตอนเช้าวัน D+1) ห้องที่ลูกค้าเช็คเอาท์เช้า D+1 ต้องมีบันทึก &quot;ลูกค้าเช็คเอาท์&quot; ลงบัญชีวัน D
            ส่วน &quot;ลูกค้าพักต่อ&quot; ทำเฉพาะเมื่อลูกค้าขอ จึงไม่ถือว่าขาด ระบบตรวจแค่ว่าห้องนั้นมีคนพักจริง
          </p>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              { label: "คืนที่มีคนพัก (ห้อง-คืน)", value: totals.occupied },
              { label: "ห้องที่เช็คเอาท์", value: totals.checkouts },
              { label: "ทำหลังเช็คเอาท์แล้ว", value: totals.cleaned },
              { label: "ลูกค้าพักต่อ (ลูกค้าขอ)", value: totals.stay },
              { label: "ผิดปกติ", value: totals.problems, bad: totals.problems > 0 },
            ].map((c) => (
              <div key={c.label} className={cn("rounded-lg p-3 text-center", c.bad ? "bg-red-50" : "bg-cream-100")}>
                <p className={cn("text-2xl font-semibold", c.bad ? "text-red-700" : "text-forest-800")}>{c.value}</p>
                <p className="text-xs text-ink-600">{c.label}</p>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto rounded-lg border border-cream-200 bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>วันที่ลงบัญชี</TableHead>
                  <TableHead className="text-right">ห้องที่มีคนพัก</TableHead>
                  <TableHead className="text-right">เช็คเอาท์เช้าวันถัดไป</TableHead>
                  <TableHead className="text-right">ทำหลังเช็คเอาท์</TableHead>
                  <TableHead className="text-right">พักต่อ (ลูกค้าขอ)</TableHead>
                  <TableHead>ผลกระทบยอด</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recon.map((n) => {
                  const problems = n.issues.filter((i) => blocking.has(i.kind));
                  const pending = n.issues.filter((i) => i.kind === "PENDING_CHECKOUT");
                  const notes = n.issues.filter((i) => i.kind === "NEVER_CHECKED_IN");
                  return (
                    <TableRow key={toDateOnlyString(n.night)}>
                      <TableCell className="whitespace-nowrap text-sm">{formatShortThaiDate(n.night)}</TableCell>
                      <TableCell className="text-right text-sm">{n.occupied}</TableCell>
                      <TableCell className="text-right text-sm">{n.checkouts}</TableCell>
                      <TableCell className="text-right text-sm">{n.checkoutCleaned}</TableCell>
                      <TableCell className="text-right text-sm">{n.stayCleans}</TableCell>
                      <TableCell className="text-sm">
                        {problems.length === 0 && pending.length === 0 && notes.length === 0 ? (
                          <span className="text-emerald-700">ตรงกัน</span>
                        ) : (
                          <span className="flex flex-col gap-0.5">
                            {problems.length > 0 && <span className="font-medium text-red-700">ผิดปกติ {problems.length} รายการ</span>}
                            {pending.length > 0 && <span className="text-amber-700">รอทำความสะอาด {pending.length} ห้อง</span>}
                            {notes.length > 0 && <span className="text-ink-600">ยังไม่เช็คอิน {notes.length} ห้อง</span>}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {allIssues.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-cream-200 bg-white">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>วันที่ลงบัญชี</TableHead>
                    <TableHead>ห้อง</TableHead>
                    <TableHead>ปัญหา</TableHead>
                    <TableHead>การจอง</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allIssues.map((i, idx) => (
                    <TableRow key={`${i.kind}-${i.resourceId}-${toDateOnlyString(i.night)}-${idx}`}>
                      <TableCell className="whitespace-nowrap text-sm">{formatShortThaiDate(i.night)}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm font-medium">{i.roomName}</TableCell>
                      <TableCell className="text-sm">
                        <span
                          className={cn(
                            blocking.has(i.kind) ? "font-medium text-red-700" : i.kind === "PENDING_CHECKOUT" ? "text-amber-700" : "text-ink-600"
                          )}
                        >
                          {ISSUE_LABELS[i.kind]}
                        </span>
                      </TableCell>
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
