import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { DailySheetActions } from "@/components/housekeeping/DailySheetActions";
import { EditCleaningButton } from "@/components/housekeeping/EditCleaningButton";
import { CLEANING_TYPE_LABELS } from "@/lib/housekeeping";
import { summarizeCleaning } from "@/lib/cleaning-summary";
import { SUPPLY_ITEMS, TRACKED_ITEMS, roomShortName, roomSizeOf } from "@/lib/housekeeping";
import { formatShortThaiDate, formatThaiDate, shiftDate, toDateOnlyString, todayDateOnly } from "@/lib/dates";

// Reviewed live by the counter — never serve a cached snapshot.
export const dynamic = "force-dynamic";

const EXTRA_BED = "เตียงเสริม";
/** Other billable services the housekeeper can record (blanket, pillow, pet, late-checkout hours), shown for the counter. */
const OTHER_SERVICES = TRACKED_ITEMS.filter((t) => t.label !== EXTRA_BED);

function otherServices(items: { name: string; quantity: number }[]): string {
  return OTHER_SERVICES.flatMap((s) => {
    const q = qtyOf(items, s.label);
    return q ? [`${s.label} ${q}${s.unit ? ` ${s.unit}` : ""}`] : [];
  }).join(", ");
}

function qtyOf(items: { name: string; quantity: number }[], name: string): number {
  return items.filter((i) => i.name === name).reduce((s, i) => s + i.quantity, 0);
}

/**
 * ADMIN and STAFF (the counter): one day's cleaning log laid out like the paper
 * "บัญชีคุมการทำความสะอาดและเบิกวัสดุสิ้นเปลือง" — a row per room cleaned, a column per supply.
 */
const MAX_RANGE_DAYS = 92;

function parseDay(v: string | undefined): Date | null {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export default async function HousekeepingDailyPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; from?: string; to?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  // Housekeepers see the same log read-only, without the amount column or the counter's sign-off.
  const isHousekeeper = session.user.role === "HOUSEKEEPER";
  const isAuditor = session.user.role === "AUDITOR";

  const today = todayDateOnly();
  const sp = await searchParams;
  // ?date= (a single day) is kept for old links; otherwise from/to pick a range, defaulting to today.
  const yesterday = shiftDate(today, -1);
  // The log is dated by the day of the stay being cleaned up, so it opens on yesterday.
  let from = parseDay(sp.from) ?? parseDay(sp.date) ?? yesterday;
  let to = parseDay(sp.to) ?? parseDay(sp.date) ?? from;
  if (from > to) [from, to] = [to, from];
  if (to > today) to = today;
  if (from > to) from = to;
  const maxFrom = shiftDate(to, -(MAX_RANGE_DAYS - 1));
  if (from < maxFrom) from = maxFrom;
  const single = from.getTime() === to.getTime();

  const [records, review, extraBedService, rooms] = await Promise.all([
    prisma.cleaningRecord.findMany({
      where: { ledgerDate: { gte: from, lte: to } },
      include: { items: true, resource: { select: { sortOrder: true, zone: true } } },
    }),
    single ? prisma.cleaningDayReview.findUnique({ where: { date: from } }) : null,
    isHousekeeper
      ? null
      : prisma.specialService.findFirst({ where: { scope: "ACCOMMODATION", name: { contains: EXTRA_BED } }, select: { price: true } }),
    prisma.resource.findMany({
      where: { type: "ACCOMMODATION" },
      orderBy: [{ zone: "asc" }, { sortOrder: "asc" }],
      select: { id: true, name: true },
    }),
  ]);

  const rows = [...records].sort(
    (a, b) =>
      a.ledgerDate.getTime() - b.ledgerDate.getTime() ||
      a.resource.zone.localeCompare(b.resource.zone) ||
      a.resource.sortOrder - b.resource.sortOrder ||
      a.createdAt.getTime() - b.createdAt.getTime()
  );
  const summary = summarizeCleaning(records);
  const bedPrice = extraBedService ? Number(extraBedService.price) : 0;
  const fromStr = toDateOnlyString(from);
  const toStr = toDateOnlyString(to);
  const todayStr = toDateOnlyString(today);
  const reviewedLabel = review
    ? `ตรวจแล้วโดย ${review.userName} ${review.createdAt.toLocaleString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short" })}`
    : null;
  const link = (f: string, t: string) => `/housekeeping-daily?from=${f}&to=${t}`;
  const monthStart = toDateOnlyString(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)));
  const nav = "rounded-full bg-cream-200 px-3 py-1.5 text-sm text-ink-600 hover:bg-cream-100";
  const title = single ? formatThaiDate(from) : `${formatThaiDate(from)} – ${formatThaiDate(to)}`;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-forest-800">บัญชีคุมการทำความสะอาดและเบิกวัสดุสิ้นเปลือง</h1>
        <p className="text-sm text-ink-600">{title}</p>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-2 print:hidden">
        <label className="flex flex-col gap-1 text-xs text-ink-600">
          ตั้งแต่วันที่
          <input type="date" name="from" defaultValue={fromStr} max={todayStr} className="h-9 rounded-md border border-cream-200 bg-white px-2 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-600">
          ถึงวันที่
          <input type="date" name="to" defaultValue={toStr} max={todayStr} className="h-9 rounded-md border border-cream-200 bg-white px-2 text-sm" />
        </label>
        <button type="submit" className="h-9 rounded-md bg-forest-700 px-4 text-sm font-medium text-cream-50 hover:bg-forest-600">
          ดูรายการ
        </button>
        <div className="flex flex-wrap items-center gap-2">
          {single && (
            <Link href={link(toDateOnlyString(shiftDate(from, -1)), toDateOnlyString(shiftDate(from, -1)))} className={nav}>
              ← วันก่อน
            </Link>
          )}
          {single && from < today && (
            <Link href={link(toDateOnlyString(shiftDate(from, 1)), toDateOnlyString(shiftDate(from, 1)))} className={nav}>
              วันถัดไป →
            </Link>
          )}
          <Link href={link(toDateOnlyString(yesterday), toDateOnlyString(yesterday))} className={nav}>เมื่อวาน</Link>
          <Link href={link(toDateOnlyString(shiftDate(today, -7)), toDateOnlyString(yesterday))} className={nav}>7 วันล่าสุด</Link>
          <Link href={link(monthStart, todayStr)} className={nav}>เดือนนี้</Link>
        </div>
      </form>

      <DailySheetActions date={fromStr} reviewedLabel={reviewedLabel} canReview={!isHousekeeper && !isAuditor && single} />

      <div className="overflow-x-auto rounded-lg border border-cream-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>วันที่</TableHead>
              <TableHead>ห้องเล็ก</TableHead>
              <TableHead>ห้องใหญ่</TableHead>
              <TableHead>อื่นๆ</TableHead>
              <TableHead>ประเภท</TableHead>
              <TableHead className="text-right">ที่นอนเสริม</TableHead>
              {!isHousekeeper && <TableHead className="text-right">จำนวนเงิน</TableHead>}
              {SUPPLY_ITEMS.map((i) => (
                <TableHead key={i.name} className="text-right">
                  {i.name}
                  <br />
                  <span className="text-xs font-normal">({i.unit})</span>
                </TableHead>
              ))}
              <TableHead>บริการเสริมอื่นๆ</TableHead>
              <TableHead>รายการแจ้งซ่อม</TableHead>
              <TableHead>หมายเหตุ</TableHead>
              <TableHead>ผู้ทำ</TableHead>
              <TableHead className="print:hidden" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={(isHousekeeper ? 6 : 7) + SUPPLY_ITEMS.length + 5} className="py-8 text-center text-sm text-ink-400">
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
                  <TableCell className="whitespace-nowrap text-sm">
                    {formatShortThaiDate(r.ledgerDate)}
                    <span className="block text-xs text-ink-400">
                      บันทึกจริง {formatShortThaiDate(r.serviceDate)} {r.createdAt.toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm font-medium">{size === "SMALL" ? cell : ""}</TableCell>
                  <TableCell className="text-sm font-medium">{size === "LARGE" ? cell : ""}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm font-medium">{size === "OTHER" ? r.roomName : ""}</TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-ink-600">{CLEANING_TYPE_LABELS[r.type]}</TableCell>
                  <TableCell className="text-right text-sm">{beds || ""}</TableCell>
                  {!isHousekeeper && (
                    <TableCell className="text-right text-sm">{beds && bedPrice ? (beds * bedPrice).toLocaleString("th-TH") : ""}</TableCell>
                  )}
                  {SUPPLY_ITEMS.map((i) => (
                    <TableCell key={i.name} className="text-right text-sm">
                      {qtyOf(r.items, i.name) || ""}
                    </TableCell>
                  ))}
                  <TableCell className="min-w-32 text-sm font-medium text-forest-800">{otherServices(r.items)}</TableCell>
                  <TableCell className="min-w-40 text-sm">{r.repairNote ?? ""}</TableCell>
                  <TableCell className="min-w-32 text-sm">{r.notes ?? ""}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm">
                    {r.userName}
                    {r.editedByName && <span className="block text-xs text-ink-400">แก้ไขโดย {r.editedByName}</span>}
                  </TableCell>
                  <TableCell className="print:hidden">
                    <EditCleaningButton
                      rooms={rooms}
                      maxDate={todayStr}
                      record={{
                        id: r.id,
                        resourceId: r.resourceId,
                        type: r.type,
                        serviceDate: toDateOnlyString(r.serviceDate),
                        ledgerDate: toDateOnlyString(r.ledgerDate),
                        items: r.items.map((i) => ({ name: i.name, quantity: i.quantity })),
                        notes: r.notes ?? "",
                        repairNote: r.repairNote ?? "",
                      }}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
            {rows.length > 0 && (
              <TableRow className="bg-cream-100 font-semibold">
                <TableCell className="text-xs">{summary.records} รายการ</TableCell>
                <TableCell className="text-sm">รวม {summary.small}</TableCell>
                <TableCell className="text-sm">รวม {summary.large}</TableCell>
                <TableCell className="text-sm">{summary.other > 0 ? `รวม ${summary.other}` : ""}</TableCell>
                <TableCell className="text-xs">{summary.rooms} ห้อง</TableCell>
                <TableCell className="text-right text-sm">{summary.supplies[EXTRA_BED] || ""}</TableCell>
                {!isHousekeeper && (
                  <TableCell className="text-right text-sm">
                    {summary.supplies[EXTRA_BED] && bedPrice ? (summary.supplies[EXTRA_BED] * bedPrice).toLocaleString("th-TH") : ""}
                  </TableCell>
                )}
                {SUPPLY_ITEMS.map((i) => (
                  <TableCell key={i.name} className="text-right text-sm">
                    {summary.supplies[i.name] || ""}
                  </TableCell>
                ))}
                <TableCell colSpan={5} className="text-sm">{single ? (reviewedLabel ?? "เคาน์เตอร์ยังไม่ได้ตรวจ") : ""}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-ink-400">
        {!isHousekeeper && (
          <>
            &quot;จำนวนเงิน&quot; คำนวณจากจำนวนที่นอนเสริมคูณราคาบริการ &quot;เตียงเสริม&quot; ในหน้าราคา เพื่อประกอบการตรวจ
            ยอดที่เก็บจริงดูที่การจอง ·{" "}
          </>
        )}
        ห้องเล็ก/ใหญ่ดูจากชื่อห้อง
      </p>
    </div>
  );
}
