import { prisma } from "@/lib/prisma";

/** Best-effort: keeps the customer directory self-populating from real bookings. Never throws —
 *  a hiccup here should never block saving the actual booking, so callers can fire-and-forget. */
export async function upsertCustomerFromBooking(input: { name: string; phone?: string | null }) {
  const name = input.name.trim();
  if (!name) return;
  const phone = input.phone?.trim() || null;

  try {
    const existing = await prisma.customer.findFirst({ where: { name } });
    if (!existing) {
      await prisma.customer.create({ data: { name, phone } });
      return;
    }
    // Fill in a phone number the directory didn't have yet; never overwrite one it already has.
    if (phone && !existing.phone) {
      await prisma.customer.update({ where: { id: existing.id }, data: { phone } });
    }
  } catch (err) {
    console.error("upsertCustomerFromBooking failed", err);
  }
}
