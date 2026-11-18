import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { PaymentStatusPill } from "@/components/payment/PaymentStatusPill";
import { accommodationExpectedTotal, banquetExpectedTotal, sumPaid } from "@/lib/payment-calc";
import { ACCOMMODATION_STATUS_LABELS, BANQUET_STATUS_LABELS } from "@/lib/labels";
import { formatThaiDate, formatTime } from "@/lib/dates";

export const dynamic = "force-dynamic";

const STATUS_VARIANT: Record<string, "success" | "gold" | "muted" | "danger"> = {
  CHECKED_IN: "success",
  RESERVED: "gold",
  CHECKED_OUT: "muted",
  CANCELLED: "danger",
  CONFIRMED: "success",
};

const baht = (n: number) => `${n.toLocaleString("th-TH", { maximumFractionDigits: 0 })} บาท`;

/**
 * Every booking made under a customer's name — rooms and banquet events, in any status (reserved, checked in,
 * checked out, cancelled). Bookings are tied to the directory by name, as everywhere else in the system.
 */
export default async function CustomerHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role === "HOUSEKEEPER") redirect("/dashboard");

  const { id } = await params;
  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) notFound();
  const name = customer.name.trim();

  const [stays, events] = await Promise.all([
    prisma.accommodationBooking.findMany({
      where: { customerName: name },
      include: { resource: true, addons: true, payment: { include: { entries: true } } },
      orderBy: { checkIn: "desc" },
    }),
    prisma.banquetBooking.findMany({
      where: { customerName: name },
      include: { resource: true, addons: true, payment: { include: { entries: true } } },
      orderBy: { eventDate: "desc" },
    }),
  ]);

  const rows = [
    ...stays.map((b) => {
      const { expectedTotal } = accommodationExpectedTotal(b, b.addons);
      return {
        key: `a-${b.id}`,
        kind: "ห้องพัก",
        href: `/accommodation/${b.id}`,
        place: b.resource.name,
        when: `${formatThaiDate(b.checkIn)} – ${formatThaiDate(b.checkOut)}`,
        sort: b.checkIn.getTime(),
        status: b.status,
        statusLabel: ACCOMMODATION_STATUS_LABELS[b.status],
        expectedTotal,
        paid: sumPaid(b.payment?.entries ?? []),
      };
    }),
    ...events.map((b) => {
      const { expectedTotal } = banquetExpectedTotal(b, b.resource, b.addons, { type: b.discountType, value: b.discountValue });
      return {
        key: `b-${b.id}`,
        kind: "ห้องจัดเลี้ยง",
        href: `/banquet/${b.id}`,
        place: b.resource.name,
        when: `${formatThaiDate(b.eventDate)} ${formatTime(b.startTime)}–${formatTime(b.endTime)}`,
        sort: b.eventDate.getTime(),
        status: b.status,
        statusLabel: BANQUET_STATUS_LABELS[b.status],
        expectedTotal,
        paid: sumPaid(b.payment?.entries ?? []),
      };
    }),
  ].sort((a, b) => b.sort - a.sort);

  const active = rows.filter((r) => r.status !== "CANCELLED");
  const total = active.reduce((s, r) => s + r.expectedTotal, 0);
  const paid = active.reduce((s, r) => s + r.paid, 0);
  const counts = {
    all: rows.length,
    upcoming: rows.filter((r) => r.status === "RESERVED" || r.status === "CONFIRMED").length,
    done: rows.filter((r) => r.status === "CHECKED_OUT").length,
    cancelled: rows.filter((r) => r.status === "CANCELLED").length,
  };

  return (
    <div className="flex flex-col gap-5">
      <Link href="/customers" className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-forest-700 hover:underline">
        <ArrowLeft className="h-4 w-4" />
        กลับไปฐานข้อมูลลูกค้า
      </Link>

      <div>
        <h1 className="text-xl font-semibold text-forest-800">ประวัติการจอง — {customer.name}</h1>
        <p className="text-sm text-ink-600">
          {[customer.phone, customer.taxId && `เลขประจำตัว ${customer.taxId}`, customer.address].filter(Boolean).join(" · ") || "ยังไม่มีข้อมูลติดต่อ"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { label: "การจองทั้งหมด", value: String(counts.all) },
          { label: "ยังไม่ถึงวัน/ยังไม่เข้าพัก", value: String(counts.upcoming) },
          { label: "เช็คเอาท์/เสร็จแล้ว", value: String(counts.done) },
          { label: "ยกเลิก", value: String(counts.cancelled) },
          { label: "ยอดรวมที่ใช้บริการ (ไม่นับที่ยกเลิก)", value: baht(total) },
        ].map((c) => (
          <div key={c.label} className="rounded-lg bg-cream-100 p-3 text-center">
            <p className="text-xl font-semibold text-forest-800">{c.value}</p>
            <p className="text-xs text-ink-600">{c.label}</p>
          </div>
        ))}
      </div>
      {total > paid && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">ยังค้างชำระรวม {baht(total - paid)} (จากยอดรวมทุกการจองที่ไม่ยกเลิก {baht(total)} ชำระแล้ว {baht(paid)})</p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>รายการจองทั้งหมด ({rows.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-400">ยังไม่มีการจองภายใต้ชื่อนี้ (ระบบจับคู่การจองกับลูกค้าจาก &quot;ชื่อ&quot; ที่ตรงกันเป๊ะ)</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ประเภท</TableHead>
                  <TableHead>ห้อง</TableHead>
                  <TableHead>วันที่</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead className="text-right">ยอดรวม</TableHead>
                  <TableHead>การชำระเงิน</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.key}>
                    <TableCell className="text-sm text-ink-600">{r.kind}</TableCell>
                    <TableCell className="font-medium">
                      <Link href={r.href} className="text-forest-700 hover:underline">
                        {r.place}
                      </Link>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">{r.when}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[r.status]}>{r.statusLabel}</Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm">{r.status === "CANCELLED" ? "—" : baht(r.expectedTotal)}</TableCell>
                    <TableCell>{r.status === "CANCELLED" ? <span className="text-ink-400">—</span> : <PaymentStatusPill paid={r.paid} expectedTotal={r.expectedTotal} />}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
