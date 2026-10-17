import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ZONE_LABELS } from "@/lib/labels";
import { todayDateOnly, shiftDate, formatThaiDate } from "@/lib/dates";
import { HousekeepingRoomCard, type HousekeepingRoom } from "@/components/housekeeping/HousekeepingRoomCard";

// Several people work this at once — never serve a cached snapshot.
export const dynamic = "force-dynamic";

const STATUS_ORDER = { NEEDS_CLEANING: 0, OUT_OF_SERVICE: 1, READY: 2 } as const;

/** The housekeeper's work list: every accommodation room, rooms needing cleaning first. */
export default async function HousekeepingPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const today = todayDateOnly();
  const [rooms, bookings, recent] = await Promise.all([
    prisma.resource.findMany({ where: { type: "ACCOMMODATION" }, orderBy: [{ zone: "asc" }, { sortOrder: "asc" }] }),
    // Only dates and status — a housekeeper never needs guest names or prices.
    prisma.accommodationBooking.findMany({
      where: { checkIn: { lte: today }, checkOut: { gte: today }, status: { not: "CANCELLED" } },
      select: { resourceId: true, checkIn: true, checkOut: true, status: true },
    }),
    prisma.housekeepingLog.findMany({
      where: { createdAt: { gte: shiftDate(new Date(), -2) } },
      orderBy: { createdAt: "desc" },
      take: 400,
    }),
  ]);

  const todayMs = today.getTime();
  const contextFor = (resourceId: string): string => {
    const list = bookings.filter((b) => b.resourceId === resourceId);
    if (list.some((b) => b.checkOut.getTime() === todayMs)) return "เช็คเอาท์วันนี้";
    if (list.some((b) => b.checkIn.getTime() === todayMs)) return "มีแขกเช็คอินวันนี้";
    if (list.some((b) => b.status !== "CHECKED_OUT")) return "มีผู้เข้าพัก";
    return "ว่าง";
  };

  const lastByRoom = new Map<string, (typeof recent)[number]>();
  for (const l of recent) if (!lastByRoom.has(l.resourceId)) lastByRoom.set(l.resourceId, l);
  const fmt = (d: Date) => d.toLocaleString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "short", timeStyle: "short" });

  const items: (HousekeepingRoom & { zone: string })[] = rooms.map((r) => {
    const last = lastByRoom.get(r.id);
    return {
      id: r.id,
      zone: r.zone,
      name: r.name,
      status: r.housekeepingStatus,
      context: contextFor(r.id),
      lastChange: last ? `${fmt(last.createdAt)} โดย ${last.userName}` : null,
    };
  });

  const counts = {
    NEEDS_CLEANING: items.filter((i) => i.status === "NEEDS_CLEANING").length,
    OUT_OF_SERVICE: items.filter((i) => i.status === "OUT_OF_SERVICE").length,
    READY: items.filter((i) => i.status === "READY").length,
  };
  const zones = Array.from(new Set(items.map((i) => i.zone)));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-forest-800">ทำความสะอาดห้องพัก</h1>
        <p className="text-sm text-ink-400">
          {formatThaiDate(today)} — กด &quot;ทำความสะอาดเสร็จแล้ว&quot; เมื่อห้องพร้อมขาย ระบบจะบันทึกชื่อและเวลาของคุณไว้
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

      {zones.map((zone) => {
        const list = items
          .filter((i) => i.zone === zone)
          .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
        return (
          <section key={zone} className="flex flex-col gap-3">
            <h2 className="text-base font-semibold text-forest-800">{ZONE_LABELS[zone] ?? zone}</h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {list.map((room) => (
                <HousekeepingRoomCard key={room.id} room={room} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
