import { prisma } from "@/lib/prisma";

export function currentMonthString(): string {
  const now = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
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
