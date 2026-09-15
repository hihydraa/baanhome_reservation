import Link from "next/link";
import { Plus } from "lucide-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PaymentStatusBadge } from "@/components/payment/PaymentStatusBadge";
import { ACCOMMODATION_STATUS_LABELS, ADDON_TYPE_LABELS, ZONE_LABELS } from "@/lib/labels";
import { toDateOnlyString } from "@/lib/dates";
import type { Prisma, Resource } from "@prisma/client";

type BookingWithRelations = Prisma.AccommodationBookingGetPayload<{
  include: { addons: true; payment: true };
}>;
type ResourceWithBooking = Resource & {
  booking?: BookingWithRelations;
};

const STATUS_ROW_CLASS: Record<string, string> = {
  CHECKED_IN: "bg-forest-700/5",
  RESERVED: "bg-gold-100/40",
  CANCELLED: "bg-cream-200/40",
};

export function DailyGrid({
  resourcesByZone,
  date,
}: {
  resourcesByZone: Record<string, ResourceWithBooking[]>;
  date: Date;
}) {
  const dateStr = toDateOnlyString(date);

  return (
    <div className="flex flex-col gap-6">
      {Object.entries(resourcesByZone).map(([zone, resources]) => (
        <div key={zone} className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-forest-800">{ZONE_LABELS[zone] ?? zone}</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ห้อง</TableHead>
                <TableHead>สถานะ</TableHead>
                <TableHead>ลูกค้า</TableHead>
                <TableHead>เบอร์โทร</TableHead>
                <TableHead>บริการเสริม</TableHead>
                <TableHead>การชำระเงิน</TableHead>
                <TableHead className="text-right">จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resources.map((r) => {
                const b = r.booking;
                const rowClass = b ? STATUS_ROW_CLASS[b.status] : "";
                return (
                  <TableRow key={r.id} className={rowClass}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell>
                      {b ? (
                        <Badge variant={b.status === "CHECKED_IN" ? "success" : "gold"}>
                          {ACCOMMODATION_STATUS_LABELS[b.status]}
                        </Badge>
                      ) : (
                        <Badge variant="muted">ว่าง</Badge>
                      )}
                    </TableCell>
                    <TableCell>{b?.customerName ?? "-"}</TableCell>
                    <TableCell>{b?.phone ?? "-"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {b?.addons.map((a) => (
                          <Badge key={a.id} variant="outline">
                            {ADDON_TYPE_LABELS[a.type]}
                            {a.quantity > 1 ? ` x${a.quantity}` : ""}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <PaymentStatusBadge status={b?.payment?.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      {b ? (
                        <Link
                          href={`/accommodation/${b.id}`}
                          className="text-sm font-medium text-forest-700 hover:underline"
                        >
                          ดู/แก้ไข
                        </Link>
                      ) : (
                        <Link
                          href={`/accommodation?newResource=${r.id}&date=${dateStr}`}
                          className="inline-flex items-center gap-1 text-sm font-medium text-gold-600 hover:underline"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          จองห้องนี้
                        </Link>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ))}
    </div>
  );
}
