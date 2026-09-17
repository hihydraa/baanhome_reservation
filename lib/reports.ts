import { prisma } from "@/lib/prisma";
import { sumPaid } from "@/lib/payment-calc";
import type { Prisma } from "@prisma/client";

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

/** Net amount actually paid for a booking, summed across every recorded payment entry. */
function netPaidAmount(payment: { entries: { amount: Prisma.Decimal }[] } | null) {
  if (!payment) return 0;
  return sumPaid(payment.entries);
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
  };
};

export async function getMonthlySummary(monthStr: string): Promise<MonthlySummary> {
  const { start, end } = monthRange(monthStr);

  const [accBookings, banquetBookings] = await Promise.all([
    prisma.accommodationBooking.findMany({
      where: { checkIn: { lt: end }, checkOut: { gt: start } },
      include: { payment: { include: { entries: true } } },
    }),
    prisma.banquetBooking.findMany({
      where: { eventDate: { gte: start, lt: end } },
      include: { payment: { include: { entries: true } } },
    }),
  ]);

  let collected = 0;
  const bySourceMap = new Map<string, number>();
  let accCancelled = 0;

  for (const b of accBookings) {
    if (b.status === "CANCELLED") {
      accCancelled++;
      continue;
    }
    bySourceMap.set(b.source, (bySourceMap.get(b.source) ?? 0) + 1);
    collected += netPaidAmount(b.payment);
  }

  let banquetCancelled = 0;
  let bookedHours = 0;
  for (const b of banquetBookings) {
    if (b.status === "CANCELLED") {
      banquetCancelled++;
      continue;
    }
    bookedHours += (b.endTime.getTime() - b.startTime.getTime()) / 3_600_000;
    collected += netPaidAmount(b.payment);
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
    revenue: { collected },
  };
}

/** Neon's Free plan storage quota per project, as of 2026. */
export const FREE_TIER_STORAGE_BYTES = 0.5 * 1024 * 1024 * 1024;

export type DatabaseStorageInfo = {
  usedBytes: number;
  limitBytes: number;
  usedRatio: number;
};

export async function getDatabaseStorageInfo(): Promise<DatabaseStorageInfo> {
  const rows = await prisma.$queryRaw<{ size: bigint | number }[]>`
    SELECT pg_database_size(current_database()) AS size
  `;
  const usedBytes = Number(rows[0]?.size ?? 0);
  return {
    usedBytes,
    limitBytes: FREE_TIER_STORAGE_BYTES,
    usedRatio: usedBytes / FREE_TIER_STORAGE_BYTES,
  };
}

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 MB";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, exponent);
  return `${value.toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}
