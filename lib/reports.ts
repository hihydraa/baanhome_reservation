import { prisma } from "@/lib/prisma";
import type { PaymentStatus } from "@prisma/client";

export function monthRange(monthStr: string): { start: Date; end: Date; days: number } {
  const [y, m] = monthStr.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start, end, days };
}

export function currentMonthString(): string {
  const now = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

const ACCOMMODATION_ZONES = ["RESORT", "POOL_VILLA"] as const;

export type ZoneOccupancy = {
  zone: (typeof ACCOMMODATION_ZONES)[number];
  roomCount: number;
  occupiedNights: number;
  capacityNights: number;
  rate: number;
};

export async function getOccupancySummary(monthStr: string): Promise<ZoneOccupancy[]> {
  const { start, end, days } = monthRange(monthStr);

  const resources = await prisma.resource.findMany({
    where: { type: "ACCOMMODATION" },
    select: { id: true, zone: true },
  });
  const zoneByResourceId = new Map(resources.map((r) => [r.id, r.zone]));
  const roomCountByZone = new Map<string, number>();
  for (const r of resources) {
    roomCountByZone.set(r.zone, (roomCountByZone.get(r.zone) ?? 0) + 1);
  }

  const bookings = await prisma.accommodationBooking.findMany({
    where: { status: { not: "CANCELLED" }, checkIn: { lt: end }, checkOut: { gt: start } },
    select: { resourceId: true, checkIn: true, checkOut: true },
  });

  const occupiedNightsByZone = new Map<string, number>();
  for (const b of bookings) {
    const zone = zoneByResourceId.get(b.resourceId);
    if (!zone) continue;
    const clippedStart = b.checkIn < start ? start : b.checkIn;
    const clippedEnd = b.checkOut > end ? end : b.checkOut;
    const nights = Math.max(0, Math.round((clippedEnd.getTime() - clippedStart.getTime()) / 86_400_000));
    occupiedNightsByZone.set(zone, (occupiedNightsByZone.get(zone) ?? 0) + nights);
  }

  return ACCOMMODATION_ZONES.map((zone) => {
    const roomCount = roomCountByZone.get(zone) ?? 0;
    const occupiedNights = occupiedNightsByZone.get(zone) ?? 0;
    const capacityNights = roomCount * days;
    const rate = capacityNights > 0 ? (occupiedNights / capacityNights) * 100 : 0;
    return { zone, roomCount, occupiedNights, capacityNights, rate };
  });
}

function collectedAmount(payment: { status: PaymentStatus; totalAmount: unknown; depositAmount: unknown } | null) {
  if (!payment) return 0;
  if (payment.status === "PAID") return Number(payment.totalAmount);
  if (payment.status === "DEPOSIT") return Number(payment.depositAmount);
  return 0;
}

export type MonthlySummary = {
  accommodation: {
    total: number;
    cancelled: number;
    bySource: { source: string; count: number }[];
  };
  banquet: {
    total: number;
    cancelled: number;
    bookedHours: number;
  };
  revenue: {
    collected: number;
    outstanding: number;
  };
};

export async function getMonthlySummary(monthStr: string): Promise<MonthlySummary> {
  const { start, end } = monthRange(monthStr);

  const [accBookings, banquetBookings] = await Promise.all([
    prisma.accommodationBooking.findMany({
      where: { checkIn: { lt: end }, checkOut: { gt: start } },
      include: { payment: true },
    }),
    prisma.banquetBooking.findMany({
      where: { eventDate: { gte: start, lt: end } },
      include: { payment: true },
    }),
  ]);

  let collected = 0;
  let outstanding = 0;
  const bySourceMap = new Map<string, number>();
  let accCancelled = 0;

  for (const b of accBookings) {
    if (b.status === "CANCELLED") {
      accCancelled++;
      continue;
    }
    bySourceMap.set(b.source, (bySourceMap.get(b.source) ?? 0) + 1);
    const total = Number(b.payment?.totalAmount ?? 0);
    const got = collectedAmount(b.payment);
    collected += got;
    outstanding += Math.max(0, total - got);
  }

  let banquetCancelled = 0;
  let bookedHours = 0;
  for (const b of banquetBookings) {
    if (b.status === "CANCELLED") {
      banquetCancelled++;
      continue;
    }
    bookedHours += (b.endTime.getTime() - b.startTime.getTime()) / 3_600_000;
    const total = Number(b.payment?.totalAmount ?? 0);
    const got = collectedAmount(b.payment);
    collected += got;
    outstanding += Math.max(0, total - got);
  }

  return {
    accommodation: {
      total: accBookings.length - accCancelled,
      cancelled: accCancelled,
      bySource: Array.from(bySourceMap.entries()).map(([source, count]) => ({ source, count })),
    },
    banquet: {
      total: banquetBookings.length - banquetCancelled,
      cancelled: banquetCancelled,
      bookedHours,
    },
    revenue: { collected, outstanding },
  };
}
