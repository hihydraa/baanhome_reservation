import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ACCOMMODATION_STATUS_LABELS } from "@/lib/labels";

/** Server component: who set each status of one booking, and when. For ADMIN / AUDITOR. */
export async function BookingStatusLogList({ bookingId }: { bookingId: string }) {
  const logs = await prisma.bookingStatusLog.findMany({ where: { bookingId }, orderBy: { createdAt: "desc" } });

  return (
    <Card>
      <CardHeader>
        <CardTitle>ประวัติสถานะการจอง ({logs.length} ครั้ง)</CardTitle>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <p className="text-sm text-ink-400">ไม่มีประวัติ (การจองนี้สร้างก่อนเริ่มเก็บประวัติสถานะ)</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {logs.map((l) => (
              <li key={l.id} className="border-l-2 border-gold-400 pl-3 text-sm">
                <p className="text-ink-900">
                  {l.fromStatus ? `${ACCOMMODATION_STATUS_LABELS[l.fromStatus]} → ` : "สร้างเป็น "}
                  <span className="font-medium">{ACCOMMODATION_STATUS_LABELS[l.toStatus]}</span>
                </p>
                <p className="text-xs text-ink-600">
                  {l.createdAt.toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })} · โดย {l.userName}
                </p>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
