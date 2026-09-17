import type { Prisma, PrismaClient } from "@prisma/client";

type ClientWithEntries = Pick<Prisma.TransactionClient | PrismaClient, "paymentEntry">;

/** Sequential per-day receipt number, e.g. RC260917-001 — shared across all bookings so the
 *  sequence matches what's printed on physical receipts. Not perfectly race-safe under heavy
 *  concurrency, but this is a small internal tool with at most a handful of staff at once;
 *  the caller retries once on a unique-constraint collision. */
export async function generateReceiptNumber(client: ClientWithEntries, paidAt: Date): Promise<string> {
  const dayStr = `${String(paidAt.getUTCFullYear()).slice(2)}${String(paidAt.getUTCMonth() + 1).padStart(
    2,
    "0"
  )}${String(paidAt.getUTCDate()).padStart(2, "0")}`;
  const dayStart = new Date(Date.UTC(paidAt.getUTCFullYear(), paidAt.getUTCMonth(), paidAt.getUTCDate()));
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  const count = await client.paymentEntry.count({ where: { paidAt: { gte: dayStart, lt: dayEnd } } });
  return `RC${dayStr}-${String(count + 1).padStart(3, "0")}`;
}
