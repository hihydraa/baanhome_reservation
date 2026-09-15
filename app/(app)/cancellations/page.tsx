import { prisma } from "@/lib/prisma";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BOOKING_TYPE_LABELS } from "@/lib/labels";

export default async function CancellationsPage() {
  const logs = await prisma.cancellationLog.findMany({
    include: { cancelledBy: true },
    orderBy: { cancelledAt: "desc" },
    take: 200,
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-forest-800">ประวัติการยกเลิก</h1>

      {logs.length === 0 ? (
        <p className="rounded-lg border border-dashed border-cream-200 p-8 text-center text-sm text-ink-400">
          ยังไม่มีการยกเลิกการจอง
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>วันที่ยกเลิก</TableHead>
              <TableHead>ประเภท</TableHead>
              <TableHead>ห้อง</TableHead>
              <TableHead>ลูกค้า</TableHead>
              <TableHead>ช่วงเวลาที่จอง</TableHead>
              <TableHead>ยกเลิกโดย</TableHead>
              <TableHead>เหตุผล</TableHead>
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
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
