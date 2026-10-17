import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { describeEntryChange, PAYMENT_ENTRY_ACTION_LABELS, PAYMENT_ENTRY_ACTION_VARIANTS } from "@/lib/payment-entry-log-format";

/** Server component: audit trail of every payment recorded, edited or deleted on one booking. */
export async function PaymentEntryLogList({ bookingId, className }: { bookingId: string; className?: string }) {
  const logs = await prisma.paymentEntryLog.findMany({
    where: { bookingId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>ประวัติการบันทึก/แก้ไข/ลบรายการชำระเงิน ({logs.length} ครั้ง)</CardTitle>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <p className="text-sm text-ink-400">ยังไม่มีประวัติ</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {logs.map((log) => (
              <li key={log.id} className="border-l-2 border-gold-400 pl-3 text-sm">
                <p className="flex flex-wrap items-center gap-2 text-xs text-ink-600">
                  <Badge variant={PAYMENT_ENTRY_ACTION_VARIANTS[log.action]}>{PAYMENT_ENTRY_ACTION_LABELS[log.action]}</Badge>
                  <span>{log.createdAt.toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}</span>
                  <span>
                    · โดย <span className="font-medium text-ink-900">{log.userName}</span>
                  </span>
                  <span className="text-ink-400">· ใบเสร็จ {log.receiptNumber}</span>
                </p>
                <ul className="list-disc pl-5 text-ink-900">
                  {describeEntryChange(log.action, log.before, log.after).map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
                {log.reason && <p className="text-xs text-ink-600">เหตุผล: {log.reason}</p>}
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
