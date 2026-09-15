import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatTime, toDateOnlyString } from "@/lib/dates";
import { BANQUET_EVENT_TYPE_LABELS } from "@/lib/labels";
import type { Prisma, Resource } from "@prisma/client";

type BanquetWithRelations = Prisma.BanquetBookingGetPayload<{ include: { payment: true } }>;
type BanquetResource = Resource & { bookings: BanquetWithRelations[] };

export function BanquetStrip({
  resources,
  date,
  readOnly = false,
}: {
  resources: BanquetResource[];
  date: Date;
  readOnly?: boolean;
}) {
  const dateStr = toDateOnlyString(date);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>ห้องจัดเลี้ยงวันนี้</CardTitle>
        {!readOnly && (
          <Link href={`/banquet?date=${dateStr}`} className="text-sm font-medium text-forest-700 hover:underline">
            ดูตารางรายชั่วโมง
          </Link>
        )}
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-3">
        {resources.map((r) => (
          <div key={r.id} className="rounded-lg border border-cream-200 bg-white p-3">
            <p className="mb-2 text-sm font-semibold text-forest-800">{r.name}</p>
            {r.bookings.length === 0 ? (
              <p className="text-xs text-ink-400">ว่างทั้งวัน</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {r.bookings.map((b) => {
                  const chipContent = (
                    <>
                      <span className="font-medium text-forest-800">
                        {formatTime(b.startTime)}-{formatTime(b.endTime)}
                        {readOnly && <span className="ml-1.5 font-normal text-ink-600">{b.customerName}</span>}
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        {BANQUET_EVENT_TYPE_LABELS[b.eventType]}
                      </Badge>
                    </>
                  );
                  if (readOnly) {
                    return (
                      <div
                        key={b.id}
                        className="flex items-center justify-between rounded-md bg-gold-100 px-2 py-1 text-xs"
                      >
                        {chipContent}
                      </div>
                    );
                  }
                  return (
                    <Link
                      key={b.id}
                      href={`/banquet/${b.id}`}
                      className="flex items-center justify-between rounded-md bg-gold-100 px-2 py-1 text-xs hover:bg-gold-100/70"
                    >
                      {chipContent}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
