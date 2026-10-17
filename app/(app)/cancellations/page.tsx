import { prisma } from "@/lib/prisma";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BOOKING_TYPE_LABELS } from "@/lib/labels";

/** For a DELETE row: total of the payments the booking had when it was deleted (from the snapshot). */
function paidOnRecord(log: { action: string; snapshot: unknown }): string | null {
  if (log.action !== "DELETE") return null;
  const entries = (log.snapshot as { payment?: { entries?: { amount: string | number }[] } } | null)?.payment?.entries ?? [];
  const total = entries.reduce((sum, e) => sum + Number(e.amount), 0);
  return total.toLocaleString("th-TH");
}

export default async function CancellationsPage() {
  const logs = await prisma.cancellationLog.findMany({
    include: { cancelledBy: true },
    orderBy: { cancelledAt: "desc" },
    take: 200,
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-forest-800">ประวัติการยกเลิก/ลบการจอง</h1>
        <p className="text-sm text-ink-400">
          &quot;ยกเลิก&quot; = พนักงานเปลี่ยนสถานะเป็นยกเลิก · &quot;ลบ&quot; = ผู้ดูแลระบบลบการจอง (ข้อมูลเดิมและยอดที่เคยรับไว้ถูกเก็บไว้)
        </p>
      </div>

      {logs.length === 0 ? (
        <p className="rounded-lg border border-dashed border-cream-200 p-8 text-center text-sm text-ink-400">
          ยังไม่มีการยกเลิกการจอง
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>วันที่</TableHead>
              <TableHead>การกระทำ</TableHead>
              <TableHead>ประเภท</TableHead>
              <TableHead>ห้อง</TableHead>
              <TableHead>ลูกค้า</TableHead>
              <TableHead>ช่วงเวลาที่จอง</TableHead>
              <TableHead>โดย</TableHead>
              <TableHead>เหตุผล</TableHead>
              <TableHead>ยอดที่เคยรับ (บาท)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="whitespace-nowrap">
                  {log.cancelledAt.toLocaleString("th-TH", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </TableCell>
                <TableCell>
                  {log.action === "DELETE" ? <Badge variant="danger">ลบ</Badge> : <Badge variant="warning">ยกเลิก</Badge>}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{BOOKING_TYPE_LABELS[log.bookingType]}</Badge>
                </TableCell>
                <TableCell className="font-medium">{log.resourceName}</TableCell>
                <TableCell>
                  <div>{log.customerName}</div>
                  {log.phone && <div className="text-xs text-ink-400">{log.phone}</div>}
                </TableCell>
                <TableCell>{log.bookingPeriod}</TableCell>
                <TableCell>{log.cancelledBy?.name ?? "-"}</TableCell>
                <TableCell className="max-w-xs">{log.reason || "-"}</TableCell>
                <TableCell className="text-right">{paidOnRecord(log) ?? "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
