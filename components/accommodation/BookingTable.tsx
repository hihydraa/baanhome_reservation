import { accommodationExpectedTotal, sumPaid } from "@/lib/payment-calc";
import { ACCOMMODATION_STATUS_LABELS } from "@/lib/labels";
import { formatThaiDate } from "@/lib/dates";
import { BookingListTable } from "@/components/accommodation/BookingListTable";
import type { Prisma } from "@prisma/client";

type Booking = Prisma.AccommodationBookingGetPayload<{
  include: { resource: true; addons: true; payment: { include: { entries: true } } };
}>;

export function BookingTable({ bookings, canCancel = false }: { bookings: Booking[]; canCancel?: boolean }) {
  const rows = bookings.map((b) => ({
    id: b.id,
    roomName: b.resource.name,
    customerName: b.customerName,
    phone: b.phone,
    checkIn: formatThaiDate(b.checkIn),
    checkOut: formatThaiDate(b.checkOut),
    status: b.status,
    statusLabel: ACCOMMODATION_STATUS_LABELS[b.status],
    paid: sumPaid(b.payment?.entries ?? []),
    expectedTotal: accommodationExpectedTotal(b, b.addons).expectedTotal,
    charterGroupId: b.charterGroupId,
  }));
  return <BookingListTable rows={rows} canCancel={canCancel} />;
}
