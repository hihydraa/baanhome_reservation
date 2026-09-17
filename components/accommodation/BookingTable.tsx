import Link from "next/link";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PaymentStatusPill } from "@/components/payment/PaymentStatusPill";
import { accommodationExpectedTotal, sumPaid } from "@/lib/payment-calc";
import { ACCOMMODATION_STATUS_LABELS } from "@/lib/labels";
import { formatThaiDate } from "@/lib/dates";
import type { Prisma } from "@prisma/client";

type Booking = Prisma.AccommodationBookingGetPayload<{
  include: { resource: true; addons: true; payment: { include: { entries: true } } };
}>;

const STATUS_VARIANT: Record<string, "success" | "gold" | "muted" | "danger"> = {
  CHECKED_IN: "success",
  RESERVED: "gold",
  CHECKED_OUT: "muted",
  CANCELLED: "danger",
};

export function BookingTable({ bookings }: { bookings: Booking[] }) {
  if (bookings.length === 0) {
    return <p className="rounded-lg border border-dashed border-cream-200 p-8 text-center text-sm text-ink-400">ไม่มีการจอง</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>ห้อง</TableHead>
          <TableHead>ลูกค้า</TableHead>
          <TableHead>เช็คอิน</TableHead>
          <TableHead>เช็คเอาท์</TableHead>
          <TableHead>สถานะ</TableHead>
          <TableHead>การชำระเงิน</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {bookings.map((b) => {
          const { expectedTotal } = accommodationExpectedTotal(b, b.addons);
          const paid = sumPaid(b.payment?.entries ?? []);
          return (
            <TableRow key={b.id}>
              <TableCell className="font-medium">
                <Link href={`/accommodation/${b.id}`} className="hover:underline text-forest-700">
                  {b.resource.name}
                </Link>
              </TableCell>
              <TableCell>
                <div>{b.customerName}</div>
                <div className="text-xs text-ink-400">{b.phone}</div>
              </TableCell>
              <TableCell>{formatThaiDate(b.checkIn)}</TableCell>
              <TableCell>{formatThaiDate(b.checkOut)}</TableCell>
              <TableCell>
                <Badge variant={STATUS_VARIANT[b.status]}>{ACCOMMODATION_STATUS_LABELS[b.status]}</Badge>
              </TableCell>
              <TableCell>
                {b.status === "CANCELLED" ? (
                  <span className="text-ink-400">—</span>
                ) : (
                  <PaymentStatusPill paid={paid} expectedTotal={expectedTotal} />
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
