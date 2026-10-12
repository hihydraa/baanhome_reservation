import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** Server component: full audit trail of quotation edits (who, when, what). */
export async function QuotationLogList({ bookingId, className }: { bookingId: string; className?: string }) {
  const logs = await prisma.quotationLog.findMany({ where: { bookingId }, orderBy: { createdAt: "desc" } });

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>ประวัติการแก้ไขใบเสนอราคา ({logs.length} ครั้ง)</CardTitle>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <p className="text-sm text-ink-400">ยังไม่มีประวัติการแก้ไข</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {logs.map((log) => (
              <li key={log.id} className="border-l-2 border-gold-400 pl-3 text-sm">
                <p className="text-xs text-ink-600">
                  {log.createdAt.toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })} · โดย{" "}
                  <span className="font-medium text-ink-900">{log.userName}</span>
                </p>
                <ul className="list-disc pl-5 text-ink-900">
                  {log.changes.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
