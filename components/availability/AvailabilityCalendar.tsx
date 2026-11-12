"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { dayDetail, summarizeDay, ZONE_LABELS, type AvailabilityInput, type DaySummary, type RoomDay } from "@/lib/availability";

type View = "occ" | "free" | "banquet";

const VIEWS: { key: View; label: string }[] = [
  { key: "occ", label: "% ห้องพักเต็ม" },
  { key: "free", label: "จำนวนห้องพักว่าง" },
  { key: "banquet", label: "ห้องจัดเลี้ยง" },
];

const WEEKDAYS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const THAI_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const STAY_LABELS = { RESERVED: "จอง", CHECKED_IN: "เข้าพัก", CHECKED_OUT: "เช็คเอาท์แล้ว" } as const;

const monthTitle = (month: string) => `${THAI_MONTHS[Number(month.slice(5, 7)) - 1]} ${Number(month.slice(0, 4)) + 543}`;
const dayTitle = (date: string) => {
  const d = new Date(`${date}T00:00:00Z`);
  return `${WEEKDAYS[d.getUTCDay()]}. ${d.getUTCDate()} ${THAI_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear() + 543}`;
};
const shortDate = (date: string) => `${Number(date.slice(8, 10))}/${Number(date.slice(5, 7))}`;

/** Fuller = warmer: green when empty, amber when half full, red when nearly or completely full. */
function fullnessClass(ratio: number) {
  if (ratio >= 1) return "bg-red-600 text-white";
  if (ratio >= 0.8) return "bg-red-300 text-red-950";
  if (ratio >= 0.5) return "bg-amber-200 text-amber-950";
  if (ratio > 0) return "bg-lime-200 text-lime-950";
  return "bg-lime-100 text-lime-900";
}

function cellFor(view: View, s: DaySummary) {
  if (view === "occ") return { main: `${s.rate}%`, sub: `${s.occupied}/${s.rooms} ห้อง`, ratio: s.rooms ? s.occupied / s.rooms : 0 };
  if (view === "free") return { main: String(s.rooms - s.occupied), sub: "ห้องว่าง", ratio: s.rooms ? s.occupied / s.rooms : 0 };
  return { main: `${s.banquetUsed}/${s.banquetRooms}`, sub: "ห้องจัดเลี้ยง", ratio: s.banquetRooms ? s.banquetUsed / s.banquetRooms : 0 };
}

export function AvailabilityCalendar({
  month,
  prevMonth,
  nextMonth,
  today,
  daysInMonth,
  input,
}: {
  month: string;
  prevMonth: string;
  nextMonth: string;
  today: string;
  daysInMonth: number;
  input: AvailabilityInput;
}) {
  const [view, setView] = useState<View>("occ");
  const [selected, setSelected] = useState<string | null>(null);

  const days = useMemo(
    () => Array.from({ length: daysInMonth }, (_, i) => summarizeDay(input, `${month}-${String(i + 1).padStart(2, "0")}`)),
    [input, month, daysInMonth]
  );
  const leading = new Date(`${month}-01T00:00:00Z`).getUTCDay();
  const detail = useMemo(() => (selected ? dayDetail(input, selected) : null), [input, selected]);
  const selectedSummary = selected ? days.find((d) => d.date === selected) : null;

  const navBtn = "flex h-9 w-9 items-center justify-center rounded-full border border-cream-200 bg-white text-forest-800 hover:bg-cream-100";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={`/availability?month=${prevMonth}`} className={navBtn} aria-label="เดือนก่อน">
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <h2 className="min-w-44 text-center text-lg font-semibold text-forest-800">{monthTitle(month)}</h2>
          <Link href={`/availability?month=${nextMonth}`} className={navBtn} aria-label="เดือนถัดไป">
            <ChevronRight className="h-4 w-4" />
          </Link>
          <Link href="/availability" className="ml-1 rounded-full border border-cream-200 px-3 py-1.5 text-xs font-medium text-forest-700 hover:bg-cream-100">
            เดือนนี้
          </Link>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => setView(v.key)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium",
                view === v.key ? "bg-forest-700 text-cream-50" : "bg-cream-200 text-ink-600 hover:bg-cream-100"
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-cream-200 bg-white p-2 sm:p-4">
        <div className="grid grid-cols-[repeat(7,minmax(0,1fr))] gap-1 sm:gap-2">
          {WEEKDAYS.map((w) => (
            <div key={w} className="pb-1 text-center text-xs text-ink-500">
              {w}
            </div>
          ))}
          {Array.from({ length: leading }).map((_, i) => (
            <div key={`b${i}`} />
          ))}
          {days.map((s) => {
            const c = cellFor(view, s);
            const past = s.date < today;
            const isToday = s.date === today;
            return (
              <button
                key={s.date}
                type="button"
                onClick={() => setSelected(s.date)}
                className={cn(
                  "flex aspect-square min-w-0 flex-col items-center justify-center rounded-xl p-1 text-center transition hover:ring-2 hover:ring-forest-700",
                  past ? "bg-stone-200/70 text-stone-500" : fullnessClass(c.ratio),
                  isToday && "ring-2 ring-forest-700"
                )}
              >
                <span className={cn("text-xs sm:text-sm", isToday && "font-bold underline")}>{Number(s.date.slice(8, 10))}</span>
                <span className="text-[11px] font-semibold sm:text-lg">{c.main}</span>
                <span className="hidden text-[10px] sm:block">{c.sub}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-600">
          {[
            { cls: "bg-lime-100", label: "ว่างทั้งหมด" },
            { cls: "bg-lime-200", label: "มีจองบางส่วน" },
            { cls: "bg-amber-200", label: "ตั้งแต่ครึ่งหนึ่ง" },
            { cls: "bg-red-300", label: "เกือบเต็ม (80%+)" },
            { cls: "bg-red-600", label: "เต็ม" },
            { cls: "bg-stone-200", label: "วันที่ผ่านมา (กดดูย้อนหลังได้)" },
          ].map((l) => (
            <span key={l.label} className="inline-flex items-center gap-1.5">
              <span className={cn("h-3.5 w-3.5 rounded-full", l.cls)} />
              {l.label}
            </span>
          ))}
        </div>
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selected && dayTitle(selected)}</DialogTitle>
          </DialogHeader>
          {selectedSummary && (
            <p className="text-sm text-ink-600">
              ห้องพักเข้าพักคืนนี้ {selectedSummary.occupied}/{selectedSummary.rooms} ห้อง ({selectedSummary.rate}%) · ห้องจัดเลี้ยงมีงาน {selectedSummary.banquetUsed}/
              {selectedSummary.banquetRooms} ห้อง
            </p>
          )}
          <div className="flex flex-col gap-5">
            {detail?.map((z) => (
              <section key={z.zone} className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between border-b border-cream-200 pb-1">
                  <h3 className="font-semibold text-forest-800">{ZONE_LABELS[z.zone]}</h3>
                  <span className="text-xs text-ink-500">
                    <span className="font-semibold text-red-700">{z.zone === "BANQUET" ? "มีงาน" : "จอง"} {z.booked}</span> ·{" "}
                    <span className="font-semibold text-emerald-700">ว่าง {z.free}</span> (ทั้งหมด {z.rooms.length})
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {z.rooms.map((r) => (
                    <RoomTile key={r.resource.id} room={r} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RoomTile({ room }: { room: RoomDay }) {
  const base = "flex flex-col gap-0.5 rounded-lg border px-3 py-2 text-sm";
  if (room.kind === "STAY") {
    return (
      <Link href={`/accommodation/${room.stay.id}`} className={cn(base, "border-red-200 bg-red-50 hover:bg-red-100")}>
        <span className="flex items-center justify-between gap-2">
          <span className="font-semibold text-ink-900">{room.resource.name}</span>
          <span className="rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-medium text-white">{STAY_LABELS[room.stay.status]}</span>
        </span>
        <span className="truncate text-ink-700">{room.stay.customerName}</span>
        <span className="text-xs text-ink-500">
          {shortDate(room.stay.checkIn)} – {shortDate(room.stay.checkOut)}
          {room.stay.charterGroupId && " · เหมา"}
        </span>
      </Link>
    );
  }
  if (room.kind === "EVENTS") {
    return (
      <div className={cn(base, "border-red-200 bg-red-50")}>
        <span className="flex items-center justify-between gap-2">
          <span className="font-semibold text-ink-900">{room.resource.name}</span>
          <span className="rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-medium text-white">มีงาน</span>
        </span>
        {room.events.map((e) => (
          <Link key={e.id} href={`/banquet?date=${e.date}`} className="truncate text-ink-700 hover:underline">
            {e.start}–{e.end} · {e.customerName}
            {e.status === "RESERVED" && <span className="text-xs text-ink-500"> (จองไว้)</span>}
          </Link>
        ))}
      </div>
    );
  }
  return (
    <div className={cn(base, "border-emerald-200 bg-emerald-50")}>
      <span className="flex items-center justify-between gap-2">
        <span className="font-semibold text-ink-900">{room.resource.name}</span>
        <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-medium text-white">ว่าง</span>
      </span>
      {room.kind === "FREE" && room.checkingOut && <span className="text-xs text-ink-500">มีแขกเช็คเอาท์เช้านี้ ({room.checkingOut.customerName})</span>}
    </div>
  );
}
