import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { HOUSEKEEPING_STATUS_LABELS } from "@/lib/labels";
import { formatShortThaiDate, shiftDate, toBangkokWallClock, toDateOnlyString, todayDateOnly } from "@/lib/dates";

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

  const [logs, checkouts] = await Promise.all([
    prisma.housekeepingLog.findMany({ where: { createdAt: { gte: since } }, orderBy: { createdAt: "desc" }, take: 1000 }),
    prisma.accommodationBooking.findMany({
      where: { checkOut: { gte: firstDay, lte: today }, status: { not: "CANCELLED" } },
      select: { checkOut: true, resourceId: true, resource: { select: { name: true } } },
    }),
  ]);

  const dayKey = (d: Date) => toDateOnlyString(toBangkokWallClock(d));
  const readyByDay = new Map<string, Set<string>>();
  for (const l of logs) {
    if (l.toStatus !== "READY") continue;
    const set = readyByDay.get(dayKey(l.createdAt)) ?? new Set<string>();
    set.add(l.resourceId);
    readyByDay.set(dayKey(l.createdAt), set);
  }
  const checkoutsByDay = new Map<string, Map<string, string>>();
  for (const b of checkouts) {
    const key = toDateOnlyString(b.checkOut);
    const rooms = checkoutsByDay.get(key) ?? new Map<string, string>();
    rooms.set(b.resourceId, b.resource.name);
    checkoutsByDay.set(key, rooms);
  }

  const daily = Array.from({ length: rangeDays }, (_, i) => shiftDate(today, -i)).map((d) => {
    const key = toDateOnlyString(d);
    const rooms = checkoutsByDay.get(key) ?? new Map<string, string>();
    const ready = readyByDay.get(key) ?? new Set<string>();
    const missing = [...rooms.entries()].filter(([id]) => !ready.has(id)).map(([, name]) => name);
    return { key, date: d, checkoutCount: rooms.size, readyCount: ready.size, missing };
  });

  const perUser = new Map<string, number>();
  for (const l of logs) {
    if (l.toStatus === "READY") perUser.set(l.userName, (perUser.get(l.userName) ?? 0) + 1);
  }

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
          ทุกครั้งที่เปลี่ยนสถานะห้อง (รอทำความสะอาด / พร้อมขาย / ชำรุด) ระบบบันทึกผู้ทำและเวลาไว้ แก้ไขหรือลบไม่ได้
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
          <CardTitle>เทียบห้องเช็คเอาท์กับห้องที่ทำเสร็จ รายวัน</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-xs text-ink-400">
            &quot;ทำเสร็จ&quot; = จำนวนห้องที่แม่บ้านเปลี่ยนเป็น &quot;พร้อมขาย&quot; ในวันนั้น (รวมห้องที่ไม่ได้เช็คเอาท์ด้วย) ห้องที่เช็คเอาท์
            แต่ไม่มีบันทึกพร้อมขายในวันเดียวกันจะแสดงชื่อห้อง — อาจทำช้าข้ามวัน ใช้ตรวจสอบเบื้องต้นเท่านั้น
          </p>
          <div className="overflow-x-auto rounded-lg border border-cream-200 bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>วันที่</TableHead>
                  <TableHead className="text-right">ห้องเช็คเอาท์</TableHead>
                  <TableHead className="text-right">ทำเสร็จ (พร้อมขาย)</TableHead>
                  <TableHead>เช็คเอาท์แล้วไม่มีบันทึกพร้อมขายวันนั้น</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {daily.map((d) => (
                  <TableRow key={d.key}>
                    <TableCell className="whitespace-nowrap text-sm">{formatShortThaiDate(d.date)}</TableCell>
                    <TableCell className="text-right text-sm">{d.checkoutCount}</TableCell>
                    <TableCell className="text-right text-sm">{d.readyCount}</TableCell>
                    <TableCell className="text-sm">
                      {d.missing.length === 0 ? "-" : <span className="font-medium text-red-700">{d.missing.join(", ")}</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>จำนวนห้องที่ทำเสร็จ แยกตามผู้ทำ ({rangeDays} วันล่าสุด)</CardTitle>
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
