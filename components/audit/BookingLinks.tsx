import Link from "next/link";
import { formatShortThaiDate } from "@/lib/dates";

export type BookingInfo = { banquets: { id: string; customerName: string; eventDate: Date }[] };

const linkClass = "text-forest-700 hover:underline";

/**
 * Where an audit row points: the accommodation booking (and any banquet booking it is linked to), or — when the
 * booking can no longer be opened — the cancellation/delete history, since a finding that points at a deleted
 * booking is itself worth a look.
 */
export function BookingLinks({
  bookingId,
  customerName,
  info,
}: {
  bookingId?: string | null;
  customerName?: string | null;
  /** Present when the booking still exists. */
  info?: BookingInfo;
}) {
  if (!bookingId) {
    return (
      <Link href="/housekeeping-daily" className={linkClass}>
        ดูบันทึกในบัญชีคุมฯ
      </Link>
    );
  }
  if (!info) {
    return (
      <span className="flex flex-col gap-0.5">
        <span className="font-medium text-red-700">ไม่พบการจองนี้ (อาจถูกลบ)</span>
        <Link href="/cancellations" className={linkClass}>
          ดูประวัติการยกเลิก/ลบ
        </Link>
      </span>
    );
  }
  return (
    <span className="flex flex-col gap-0.5">
      <Link href={`/accommodation/${bookingId}`} className={linkClass}>
        {customerName || "ดูการจอง"} ↗
      </Link>
      {info.banquets.map((b) => (
        <Link key={b.id} href={`/banquet/${b.id}`} className={linkClass}>
          จัดเลี้ยงที่เชื่อม: {b.customerName} ({formatShortThaiDate(b.eventDate)}) ↗
        </Link>
      ))}
    </span>
  );
}
