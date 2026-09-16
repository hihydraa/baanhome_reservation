import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess, errorResponse } from "@/lib/api-helpers";
import { parseDateOnly, formatTime, toDateOnlyString } from "@/lib/dates";
import {
  SOURCE_LABELS,
  ACCOMMODATION_STATUS_LABELS,
  BANQUET_EVENT_TYPE_LABELS,
  BANQUET_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
} from "@/lib/labels";

function csvField(value: string | number): string {
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function csvRow(fields: (string | number)[]): string {
  return fields.map(csvField).join(",") + "\r\n";
}

export async function GET(req: NextRequest) {
  const { response } = await requireStaffAccess();
  if (response) return response;

  const fromParam = req.nextUrl.searchParams.get("from");
  const toParam = req.nextUrl.searchParams.get("to");
  if (!fromParam || !toParam) {
    return errorResponse("กรุณาระบุช่วงวันที่ (from, to)", 400);
  }

  const from = parseDateOnly(fromParam);
  const toExclusive = new Date(parseDateOnly(toParam));
  toExclusive.setUTCDate(toExclusive.getUTCDate() + 1);

  const [accBookings, banquetBookings] = await Promise.all([
    prisma.accommodationBooking.findMany({
      where: { checkIn: { lt: toExclusive }, checkOut: { gt: from } },
      include: { resource: true, payment: true },
      orderBy: { checkIn: "asc" },
    }),
    prisma.banquetBooking.findMany({
      where: { eventDate: { gte: from, lt: toExclusive } },
      include: { resource: true, payment: true },
      orderBy: { eventDate: "asc" },
    }),
  ]);

  const header = [
    "ประเภท",
    "ห้อง/สถานที่",
    "ลูกค้า",
    "เบอร์โทร",
    "เริ่ม",
    "สิ้นสุด",
    "ช่องทาง/ประเภทงาน",
    "สถานะการจอง",
    "มัดจำ",
    "จ่ายแล้ว",
    "รวมจ่ายสุทธิ",
    "สถานะการชำระเงิน",
    "หมายเหตุ",
  ];

  let csv = "﻿" + csvRow(header);

  for (const b of accBookings) {
    const deposit = Number(b.payment?.depositAmount ?? 0);
    const paid = Number(b.payment?.totalAmount ?? 0);
    csv += csvRow([
      "ห้องพัก",
      b.resource.name,
      b.customerName,
      b.phone,
      toDateOnlyString(b.checkIn),
      toDateOnlyString(b.checkOut),
      SOURCE_LABELS[b.source] ?? b.source,
      ACCOMMODATION_STATUS_LABELS[b.status] ?? b.status,
      deposit,
      paid,
      deposit + paid,
      b.payment ? PAYMENT_STATUS_LABELS[b.payment.status] ?? b.payment.status : "-",
      b.notes ?? "",
    ]);
  }

  for (const b of banquetBookings) {
    const deposit = Number(b.payment?.depositAmount ?? 0);
    const paid = Number(b.payment?.totalAmount ?? 0);
    csv += csvRow([
      "ห้องจัดเลี้ยง",
      b.resource.name,
      b.customerName,
      b.phone ?? "",
      `${toDateOnlyString(b.eventDate)} ${formatTime(b.startTime)}`,
      `${toDateOnlyString(b.eventDate)} ${formatTime(b.endTime)}`,
      BANQUET_EVENT_TYPE_LABELS[b.eventType] ?? b.eventType,
      BANQUET_STATUS_LABELS[b.status] ?? b.status,
      deposit,
      paid,
      deposit + paid,
      b.payment ? PAYMENT_STATUS_LABELS[b.payment.status] ?? b.payment.status : "-",
      b.notes ?? "",
    ]);
  }

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="baanhome-report-${fromParam}_to_${toParam}.csv"`,
    },
  });
}
