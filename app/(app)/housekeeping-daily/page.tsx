import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { DailySheetActions } from "@/components/housekeeping/DailySheetActions";
import { summarizeCleaning } from "@/lib/cleaning-summary";
import { SUPPLY_ITEMS, roomShortName, roomSizeOf } from "@/lib/housekeeping";
import { formatThaiDate, shiftDate, toDateOnlyString, todayDateOnly } from "@/lib/dates";

// Reviewed live by the counter — never serve a cached snapshot.
export const dynamic = "force-dynamic";

const EXTRA_BED = "เตียงเสริม";

function qtyOf(items: { name: string; quantity: number }[], name: string): number {
  return items.filter((i) => i.name === name).reduce((s, i) => s + i.quantity, 0);
}

/**
 * ADMIN and STAFF (the counter): one day's cleaning log laid out like the paper
 * "บัญชีคุมการทำความสะอาดและเบิกวัสดุสิ้นเปลือง" — a row per room cleaned, a column per supply.
 */
export default async function HousekeepingDailyPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role === "HOUSEKEEPER") redirect("/dashboard");

  const today = todayDateOnly();
  const { date: dateParam } = await searchParams;
  const parsed = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? new Date(`${dateParam}T00:00:00Z`) : today;
  const date = Number.isNaN(parsed.getTime()) ? today : parsed;

  const [records, review, extraBedService] = await Promise.all([
    prisma.cleaningRecord.findMany({
      where: { serviceDate: date },
      include: { items: true, resource: { select: { sortOrder: true, zone: true } } },
    }),
    prisma.cleaningDayReview.findUnique({ where: { date } }),
    prisma.specialService.findFirst({ where: { scope: "ACCOMMODATION", name: { contains: EXTRA_BED } }, select: { price: true } }),
  ]);

  const rows = [...records].sort(
    (a, b) => a.resource.zone.localeCompare(b.resource.zone) || a.resource.sortOrder - b.resource.sortOrder || a.createdAt.getTime() - b.createdAt.getTime()
  );
  const summary = summarizeCleaning(records);
  const bedPrice = extraBedService ? Number(extraBedService.price) : 0;
  const dateStr = toDateOnlyString(date);
  const prev = toDateOnlyString(shiftDate(date, -1));
  const next = date < today ? toDateOnlyString(shiftDate(date, 1)) : null;
  const reviewedLabel = review
    ? `ตรวจแล้วโดย ${review.userName} ${review.createdAt.toLocaleString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short" })}`
    : null;
  const nav = "rounded-full bg-cream-200 px-3 py-1.5 text-sm text-ink-600 hover:bg-cream-100";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-forest-800">บัญชีคุมการทำความสะอาดและเบิกวัสดุสิ้นเปลือง</h1>
          <p className="text-sm text-ink-600">{formatThaiDate(date)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <Link href={`/housekeeping-daily?date=${prev}`} className={nav}>← วันก่อน</Link>
          {next && <Link href={`/housekeeping-daily?date=${next}`} className={nav}>วันถัดไป →</Link>}
          {date < today && <Link href="/housekeeping-daily" className={nav}>วันนี้</Link>}
        </div>
      </div>

      <DailySheetActions date={dateStr} reviewedLabel={reviewedLabel} />

      <div className="overflow-x-auto rounded-lg border border-cream-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ห้องเล็ก</TableHead>
              <TableHead>ห้องใหญ่</TableHead>
              <TableHead>อื่นๆ</TableHead>
              <TableHead>ประเภท</TableHead>
              <TableHead className="text-right">ที่นอนเสริม</TableHead>
              <TableHead className="text-right">จำนวนเงิน</TableHead>
              {SUPPLY_ITEMS.map((i) => (
                <TableHead key={i.name} className="text-right">
                  {i.name}
                  <br />
                  <span className="text-xs font-normal">({i.unit})</span>
                </TableHead>
              ))}
              <TableHead>รายการแจ้งซ่อม</TableHead>
              <TableHead>หมายเหตุ</TableHead>
              <TableHead>ผู้ทำ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6 + SUPPLY_ITEMS.length + 3} className="py-8 text-center text-sm text-ink-400">
                  ไม่มีบันทึกการทำความสะอาดในวันนี้
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => {
              const size = roomSizeOf(r.roomName);
              const cell = roomShortName(r.roomName);
              const beds = qtyOf(r.items, EXTRA_BED);
              return (
                <TableRow key={r.id}>
                  <TableCell className="text-sm font-medium">{size === "SMALL" ? cell : ""}</TableCell>
                  <TableCell className="text-sm font-medium">{size === "LARGE" ? cell : ""}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm font-medium">{size === "OTHER" ? r.roomName : ""}</TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-ink-600">{r.type === "CHECKOUT" ? "เช็คเอาท์" : "ระหว่างพัก"}</TableCell>
                  <TableCell className="text-right text-sm">{beds || ""}</TableCell>
                  <TableCell className="text-right text-sm">{beds && bedPrice ? (beds * bedPrice).toLocaleString("th-TH") : ""}</TableCell>
                  {SUPPLY_ITEMS.map((i) => (
                    <TableCell key={i.name} className="text-right text-sm">
                      {qtyOf(r.items, i.name) || ""}
                    </TableCell>
                  ))}
                  <TableCell className="min-w-40 text-sm">{r.repairNote ?? ""}</TableCell>
                  <TableCell className="min-w-32 text-sm">{r.notes ?? ""}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{r.userName}</TableCell>
                </TableRow>
              );
            })}
            {rows.length > 0 && (
              <TableRow className="bg-cream-100 font-semibold">
                <TableCell className="text-sm">รวม {summary.small}</TableCell>
                <TableCell className="text-sm">รวม {summary.large}</TableCell>
                <TableCell className="text-sm">{summary.other > 0 ? `รวม ${summary.other}` : ""}</TableCell>
                <TableCell className="text-xs">{summary.rooms} ห้อง</TableCell>
                <TableCell className="text-right text-sm">{summary.supplies[EXTRA_BED] || ""}</TableCell>
                <TableCell className="text-right text-sm">
                  {summary.supplies[EXTRA_BED] && bedPrice ? (summary.supplies[EXTRA_BED] * bedPrice).toLocaleString("th-TH") : ""}
                </TableCell>
                {SUPPLY_ITEMS.map((i) => (
                  <TableCell key={i.name} className="text-right text-sm">
                    {summary.supplies[i.name] || ""}
                  </TableCell>
                ))}
                <TableCell colSpan={3} className="text-sm">{reviewedLabel ?? "เคาน์เตอร์ยังไม่ได้ตรวจ"}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-ink-400">
        &quot;จำนวนเงิน&quot; คำนวณจากจำนวนที่นอนเสริมคูณราคาบริการ &quot;เตียงเสริม&quot; ในหน้าราคา เพื่อประกอบการตรวจ
        ยอดที่เก็บจริงดูที่การจอง · ห้องเล็ก/ใหญ่ดูจากชื่อห้อง
      </p>
    </div>
  );
}
