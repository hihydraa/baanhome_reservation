import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ZONE_LABELS } from "@/lib/labels";
import { CLEANING_TYPE_LABELS } from "@/lib/housekeeping";
import { todayDateOnly, formatThaiDate, shiftDate, toDateOnlyString } from "@/lib/dates";
import { summarizeCleaning } from "@/lib/cleaning-summary";
import { AMOUNT_KEYS, SUPPLY_ITEMS, TRACKED_ITEMS } from "@/lib/housekeeping";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HousekeepingRoomCard, type HousekeepingRoom } from "@/components/housekeeping/HousekeepingRoomCard";

// Several people work this at once — never serve a cached snapshot.
export const dynamic = "force-dynamic";

const STATUS_ORDER = { NEEDS_CLEANING: 0, OUT_OF_SERVICE: 1, READY: 2 } as const;

/** The housekeeper's work list: every accommodation room, rooms needing cleaning first. */
export default async function HousekeepingPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  // Housekeepers do the work here; the admin can look. Front-desk staff use the log sheet instead.
  if (session.user.role === "STAFF" || session.user.role === "AUDITOR") redirect("/dashboard");

  const today = todayDateOnly();
  const { date: dateParam } = await searchParams;
  // The summary is by the date the log shows (a morning cleaning is logged under yesterday), defaulting to
  // yesterday and able to look back; the room cards are always today's recordings.
  const yesterday = shiftDate(today, -1);
  const parsedDate = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? new Date(`${dateParam}T00:00:00Z`) : yesterday;
  const summaryDate = Number.isNaN(parsedDate.getTime()) || parsedDate > today ? yesterday : parsedDate;
  const [rooms, bookings, records, summaryRecords] = await Promise.all([
    prisma.resource.findMany({ where: { type: "ACCOMMODATION" }, orderBy: [{ zone: "asc" }, { sortOrder: "asc" }] }),
    // Only dates and status — a housekeeper never needs guest names or prices.
    prisma.accommodationBooking.findMany({
      where: { checkIn: { lte: today }, checkOut: { gte: today }, status: { not: "CANCELLED" } },
      select: { resourceId: true, checkIn: true, checkOut: true, status: true },
    }),
    prisma.cleaningRecord.findMany({
      where: { serviceDate: today },
      orderBy: { createdAt: "asc" },
      include: { items: true },
    }),
    prisma.cleaningRecord.findMany({ where: { ledgerDate: summaryDate }, include: { items: true } }),
  ]);
  const summary = summarizeCleaning(summaryRecords);
  const prevDay = toDateOnlyString(shiftDate(summaryDate, -1));
  const nextDay = summaryDate < today ? toDateOnlyString(shiftDate(summaryDate, 1)) : null;
  const isYesterday = summaryDate.getTime() === yesterday.getTime();

  const todayMs = today.getTime();
  const contextFor = (resourceId: string): string => {
    const list = bookings.filter((b) => b.resourceId === resourceId);
    if (list.some((b) => b.checkOut.getTime() === todayMs)) return "เช็คเอาท์วันนี้";
    if (list.some((b) => b.checkIn.getTime() === todayMs)) return "มีแขกเช็คอินวันนี้";
    if (list.some((b) => b.status !== "CHECKED_OUT")) return "มีผู้เข้าพัก";
    return "ว่าง";
  };

  const todayStr = toDateOnlyString(today);
  const recordLines = new Map<string, HousekeepingRoom["todayRecords"]>();
  for (const r of records) {
    const supplies = r.items.map((i) => (i.category && AMOUNT_KEYS.includes(i.category) ? `${i.name} ${i.quantity.toLocaleString("th-TH")} บาท` : `${i.name} ×${i.quantity}`)).join(", ");
    recordLines.set(r.resourceId, [
      ...(recordLines.get(r.resourceId) ?? []),
      {
        id: r.id,
        label: `${CLEANING_TYPE_LABELS[r.type]}${supplies ? ` — เบิก ${supplies}` : ""} (${r.userName}${r.editedByName ? `, แก้ไขโดย ${r.editedByName}` : ""})`,
        form: {
          id: r.id,
          resourceId: r.resourceId,
          type: r.type,
          serviceDate: toDateOnlyString(r.serviceDate),
          ledgerDate: toDateOnlyString(r.ledgerDate),
          items: r.items.map((i) => ({ name: i.name, quantity: i.quantity })),
          notes: r.notes ?? "",
          repairNote: r.repairNote ?? "",
        },
      },
    ]);
  }

  const items: (HousekeepingRoom & { zone: string })[] = rooms.map((r) => ({
    id: r.id,
    zone: r.zone,
    name: r.name,
    status: r.housekeepingStatus,
    context: contextFor(r.id),
    todayRecords: recordLines.get(r.id) ?? [],
  }));

  const counts = {
    NEEDS_CLEANING: items.filter((i) => i.status === "NEEDS_CLEANING").length,
    OUT_OF_SERVICE: items.filter((i) => i.status === "OUT_OF_SERVICE").length,
    READY: items.filter((i) => i.status === "READY").length,
  };
  const roomOptions = rooms.map((r) => ({ id: r.id, name: r.name }));
  const zones = Array.from(new Set(items.map((i) => i.zone)));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-forest-800">ทำความสะอาดห้องพัก</h1>
        <p className="text-sm text-ink-400">
          {formatThaiDate(today)} — เลือกห้อง กด &quot;ทำความสะอาดห้องแล้ว&quot; เลือกประเภท และบันทึกของที่เบิก ระบบจะบันทึกชื่อและเวลาของคุณไว้
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
          <p className="text-2xl font-semibold text-amber-800">{counts.NEEDS_CLEANING}</p>
          <p className="text-xs text-amber-800">รอทำความสะอาด</p>
        </div>
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3">
          <p className="text-2xl font-semibold text-emerald-800">{counts.READY}</p>
          <p className="text-xs text-emerald-800">พร้อมขาย</p>
        </div>
        <div className="rounded-lg border border-red-300 bg-red-50 p-3">
          <p className="text-2xl font-semibold text-red-800">{counts.OUT_OF_SERVICE}</p>
          <p className="text-xs text-red-800">ชำรุด</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>สรุปการทำความสะอาด วันที่ลงบัญชี {isYesterday ? "เมื่อวาน " : ""}{formatThaiDate(summaryDate)}</CardTitle>
            <div className="flex items-center gap-2 text-sm">
              <Link href={`/housekeeping?date=${prevDay}`} className="rounded-full bg-cream-200 px-3 py-1 text-ink-600 hover:bg-cream-100">
                ← วันก่อน
              </Link>
              {nextDay && (
                <Link href={`/housekeeping?date=${nextDay}`} className="rounded-full bg-cream-200 px-3 py-1 text-ink-600 hover:bg-cream-100">
                  วันถัดไป →
                </Link>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {summary.records === 0 ? (
            <p className="text-sm text-ink-400">ยังไม่มีบันทึกการทำความสะอาดที่ลงบัญชีวันนี้</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg bg-cream-100 p-3 text-center">
                  <p className="text-2xl font-semibold text-forest-800">{summary.rooms}</p>
                  <p className="text-xs text-ink-600">ห้องที่ทำทั้งหมด</p>
                </div>
                <div className="rounded-lg bg-cream-100 p-3 text-center">
                  <p className="text-2xl font-semibold text-forest-800">{summary.small}</p>
                  <p className="text-xs text-ink-600">ห้องเล็ก</p>
                </div>
                <div className="rounded-lg bg-cream-100 p-3 text-center">
                  <p className="text-2xl font-semibold text-forest-800">{summary.large}</p>
                  <p className="text-xs text-ink-600">ห้องใหญ่</p>
                </div>
                <div className="rounded-lg bg-cream-100 p-3 text-center">
                  <p className="text-2xl font-semibold text-forest-800">{summary.other}</p>
                  <p className="text-xs text-ink-600">พูลวิลล่า/อื่นๆ</p>
                </div>
              </div>
              <p className="text-sm text-ink-600">
                หลังลูกค้าเช็คเอาท์ {summary.checkoutCleans} ครั้ง · ลูกค้าพักต่อ {summary.stayCleans} ครั้ง
              </p>
              <div>
                <p className="mb-1 text-sm font-medium text-ink-900">เบิกไปทั้งหมด</p>
                <div className="flex flex-wrap gap-2">
                  {[...SUPPLY_ITEMS.map((i) => ({ name: i.name, unit: i.unit })), ...Object.keys(summary.supplies).filter((n) => !SUPPLY_ITEMS.some((i) => i.name === n)).map((name) => ({ name, unit: TRACKED_ITEMS.find((t) => t.label === name)?.unit ?? "" }))]
                    .filter((i) => (summary.supplies[i.name] ?? 0) > 0)
                    .map((i) => (
                      <span key={i.name} className="rounded-full border border-cream-200 bg-white px-3 py-1 text-sm">
                        {i.name} <span className="font-semibold">{summary.supplies[i.name]}</span> {i.unit}
                      </span>
                    ))}
                  {Object.values(summary.supplies).every((v) => v === 0) && <span className="text-sm text-ink-400">ไม่มีการเบิก</span>}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {zones.map((zone) => {
        const list = items
          .filter((i) => i.zone === zone)
          .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
        return (
          <section key={zone} className="flex flex-col gap-3">
            <h2 className="text-base font-semibold text-forest-800">{ZONE_LABELS[zone] ?? zone}</h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {list.map((room) => (
                <HousekeepingRoomCard key={room.id} room={room} rooms={roomOptions} maxDate={todayStr} defaultLedgerDate={toDateOnlyString(yesterday)} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
