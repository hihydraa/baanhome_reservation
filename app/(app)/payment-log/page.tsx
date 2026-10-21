import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  describeEntryChange,
  PAYMENT_ENTRY_ACTION_LABELS,
  PAYMENT_ENTRY_ACTION_VARIANTS,
} from "@/lib/payment-entry-log-format";

// Audit view — never serve a cached snapshot.
export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * DAY_MS);
}

/**
 * ADMIN and AUDITOR only: every payment recorded, edited or deleted, newest first. Defaults to edits/deletes
 * (the rows that change money already received); "ทั้งหมด" also shows normal receipts.
 */
export default async function PaymentLogPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string; days?: string }>;
}) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "AUDITOR")) {
    redirect("/dashboard");
  }

  const { show, days } = await searchParams;
  const showAll = show === "all";
  const rangeDays = [7, 30, 90].includes(Number(days)) ? Number(days) : 30;
  const since = daysAgo(rangeDays);

  const [logs, perUser] = await Promise.all([
    prisma.paymentEntryLog.findMany({
      where: { createdAt: { gte: since }, ...(showAll ? {} : { action: { in: ["UPDATE", "DELETE"] } }) },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    prisma.paymentEntryLog.groupBy({
      by: ["userName", "action"],
      where: { createdAt: { gte: since }, action: { in: ["UPDATE", "DELETE"] } },
      _count: { _all: true },
    }),
  ]);

  const userSummary = new Map<string, { UPDATE: number; DELETE: number }>();
  for (const row of perUser) {
    const cur = userSummary.get(row.userName) ?? { UPDATE: 0, DELETE: 0 };
    if (row.action === "UPDATE" || row.action === "DELETE") cur[row.action] = row._count._all;
    userSummary.set(row.userName, cur);
  }

  const href = (p: { show?: string; days?: number }) => {
    const q = new URLSearchParams();
    const s = p.show ?? (showAll ? "all" : undefined);
    if (s) q.set("show", s);
    q.set("days", String(p.days ?? rangeDays));
    return `/payment-log?${q.toString()}`;
  };
  const chip = (active: boolean) =>
    cn(
      "rounded-full px-3 py-1.5 text-xs font-medium",
      active ? "bg-forest-700 text-cream-50" : "bg-cream-200 text-ink-600 hover:bg-cream-100"
    );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-forest-800">ประวัติแก้ไขการรับเงิน</h1>
        <p className="text-sm text-ink-400">
          ทุกการรับชำระ แก้ไข และลบรายการชำระเงิน — เก็บค่าเดิม ค่าใหม่ ผู้ทำ เวลา และเหตุผล แก้ไขหรือลบประวัตินี้ไม่ได้
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Link href={href({ show: "changes" })} className={chip(!showAll)}>
          เฉพาะแก้ไข/ลบ
        </Link>
        <Link href={href({ show: "all" })} className={chip(showAll)}>
          ทั้งหมด (รวมรับชำระปกติ)
        </Link>
        <span className="mx-1 text-ink-400">|</span>
        {[7, 30, 90].map((d) => (
          <Link key={d} href={href({ days: d })} className={chip(rangeDays === d)}>
            {d} วันล่าสุด
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>สรุปการแก้ไข/ลบรายการรับเงิน แยกตามผู้ทำ ({rangeDays} วันล่าสุด)</CardTitle>
        </CardHeader>
        <CardContent>
          {userSummary.size === 0 ? (
            <p className="text-sm text-ink-400">ไม่มีการแก้ไขหรือลบรายการรับเงินในช่วงนี้</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {[...userSummary.entries()]
                .sort((a, b) => b[1].UPDATE + b[1].DELETE - (a[1].UPDATE + a[1].DELETE))
                .map(([name, c]) => (
                  <div key={name} className="rounded-lg border border-cream-200 bg-white px-3 py-2 text-sm">
                    <p className="font-medium text-ink-900">{name}</p>
                    <p className="text-xs text-ink-600">
                      แก้ไข {c.UPDATE} · <span className={c.DELETE > 0 ? "font-semibold text-red-700" : ""}>ลบ {c.DELETE}</span>
                    </p>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {logs.length === 0 ? (
        <p className="rounded-lg border border-dashed border-cream-200 p-8 text-center text-sm text-ink-400">
          ไม่มีรายการในช่วงนี้
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-cream-200 bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>วันที่/เวลา</TableHead>
                <TableHead>การกระทำ</TableHead>
                <TableHead>ใบเสร็จ</TableHead>
                <TableHead>การจอง</TableHead>
                <TableHead>รายละเอียด</TableHead>
                <TableHead>เหตุผล</TableHead>
                <TableHead>โดย</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => {
                const bookingHref =
                  log.bookingId && log.bookingType === "ACCOMMODATION"
                    ? `/accommodation/${log.bookingId}`
                    : log.bookingId && log.bookingType === "BANQUET"
                      ? `/banquet/${log.bookingId}`
                      : null;
                return (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {log.createdAt.toLocaleString("th-TH", {
                        timeZone: "Asia/Bangkok",
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </TableCell>
                    <TableCell>
                      <Badge variant={PAYMENT_ENTRY_ACTION_VARIANTS[log.action]}>
                        {PAYMENT_ENTRY_ACTION_LABELS[log.action]}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">{log.receiptNumber}</TableCell>
                    <TableCell className="min-w-48 text-sm">
                      {bookingHref ? (
                        <Link href={bookingHref} className="text-forest-700 hover:underline">
                          {log.bookingLabel}
                        </Link>
                      ) : (
                        log.bookingLabel
                      )}
                    </TableCell>
                    <TableCell className="min-w-56 text-sm">
                      <ul className="flex flex-col gap-0.5">
                        {describeEntryChange(log.action, log.before, log.after).map((line, i) => (
                          <li key={i}>{line}</li>
                        ))}
                      </ul>
                    </TableCell>
                    <TableCell className="max-w-xs text-sm">{log.reason || "-"}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm">{log.userName}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
