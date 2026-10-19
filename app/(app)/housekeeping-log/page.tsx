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

// Audit view — never serve a cached snapshot.
export const dynamic = "force-dynamic";

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

/**
 * ADMIN and STAFF: the history of every housekeeping status change, plus a per-day check of
 * rooms that checked out against rooms housekeeping marked ready ("พร้อมขาย") that day.
 */
export default async function HousekeepingLogPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role === "HOUSEKEEPER") redirect("/dashboard");

  const { days } = await searchParams;
  const rangeDays = [7, 14, 30].includes(Number(days)) ? Number(days) : 7;
  const today = todayDateOnly();
  const firstDay = shiftDate(today, -(rangeDays - 1));
  // Log timestamps are real instants; day buckets are Bangkok calendar days.
  const since = new Date(firstDay.getTime() - BANGKOK_OFFSET_MS);

  const [logs, checkouts, stays, records] = await Promise.all([
    prisma.housekeepingLog.findMany({ where: { createdAt: { gte: since } }, orderBy: { createdAt: "desc" }, take: 500 }),
    prisma.accommodationBooking.findMany({
      where: { checkOut: { gte: firstDay, lte: today }, status: { not: "CANCELLED" } },
      select: { checkOut: true, resourceId: true, resource: { select: { name: true } } },
    }),
    // Every stay that overlaps the range — used to audit supplies against billed add-ons.
    prisma.accommodationBooking.findMany({
      where: { checkIn: { lte: today }, checkOut: { gt: firstDay }, status: { not: "CANCELLED" } },
      select: {
        id: true,
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
      where: { serviceDate: { gte: shiftDate(firstDay, -30), lte: today } },
      orderBy: { createdAt: "desc" },
      include: { items: true },
    }),
  ]);

  // ----- daily: checked-out rooms vs rooms cleaned for checkout -----
  const dayKeyOf = (d: Date) => toDateOnlyString(d);
  const cleanedByDay = new Map<string, Set<string>>();
  const stayCleansByDay = new Map<string, number>();
  for (const r of records) {
    const k = dayKeyOf(r.serviceDate);
    if (r.type === "CHECKOUT") cleanedByDay.set(k, (cleanedByDay.get(k) ?? new Set<string>()).add(r.resourceId));
    else stayCleansByDay.set(k, (stayCleansByDay.get(k) ?? 0) + 1);
  }
  const checkoutsByDay = new Map<string, Map<string, string>>();
  for (const b of checkouts) {
    const key = dayKeyOf(b.checkOut);
    const rooms = checkoutsByDay.get(key) ?? new Map<string, string>();
    rooms.set(b.resourceId, b.resource.name);
    checkoutsByDay.set(key, rooms);
  }
  const daily = Array.from({ length: rangeDays }, (_, i) => shiftDate(today, -i)).map((d) => {
    const key = dayKeyOf(d);
    const rooms = checkoutsByDay.get(key) ?? new Map<string, string>();
    const cleaned = cleanedByDay.get(key) ?? new Set<string>();
    return {
      key,
      date: d,
      checkoutCount: rooms.size,
      cleanedCount: cleaned.size,
      stayCleans: stayCleansByDay.get(key) ?? 0,
      missing: [...rooms.entries()].filter(([id]) => !cleaned.has(id)).map(([, name]) => name),
      extra: [...cleaned].filter((id) => !rooms.has(id)).length,
    };
  });

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
          <CardTitle>ห้องที่ลูกค้าเช็คเอาท์ เทียบกับห้องที่แม่บ้านบันทึกทำความสะอาด</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-xs text-ink-400">
            เทียบจากการจองที่เช็คเอาท์ในวันนั้น กับบันทึกประเภท &quot;ลูกค้าเช็คเอาท์&quot; ของแม่บ้านในวันเดียวกัน ห้องที่ขาดบันทึกจะแสดงชื่อ
            (ถ้าทำช้าข้ามวันจะขึ้นเป็นขาดด้วย)
          </p>
          <div className="overflow-x-auto rounded-lg border border-cream-200 bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>วันที่</TableHead>
                  <TableHead className="text-right">เช็คเอาท์</TableHead>
                  <TableHead className="text-right">ทำหลังเช็คเอาท์</TableHead>
                  <TableHead className="text-right">ทำเมื่อลูกค้าพักต่อ</TableHead>
                  <TableHead>ห้องที่ขาดบันทึก</TableHead>
                  <TableHead>หมายเหตุ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {daily.map((d) => (
                  <TableRow key={d.key}>
                    <TableCell className="whitespace-nowrap text-sm">{formatShortThaiDate(d.date)}</TableCell>
                    <TableCell className="text-right text-sm">{d.checkoutCount}</TableCell>
                    <TableCell className="text-right text-sm">{d.cleanedCount}</TableCell>
                    <TableCell className="text-right text-sm">{d.stayCleans}</TableCell>
                    <TableCell className="text-sm">
                      {d.missing.length === 0 ? "-" : <span className="font-medium text-red-700">{d.missing.join(", ")}</span>}
                    </TableCell>
                    <TableCell className="text-sm text-ink-600">{d.extra > 0 ? `ทำ ${d.extra} ห้องที่ไม่มีเช็คเอาท์วันนี้` : ""}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
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
