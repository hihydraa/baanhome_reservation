import { prisma } from "@/lib/prisma";

/** Best-effort: keeps the customer directory self-populating from real bookings. Never throws —
 *  a hiccup here should never block saving the actual booking, so callers can fire-and-forget. */
export async function upsertCustomerFromBooking(input: {
  name: string;
  phone?: string | null;
  /** Typed into the booking form on purpose, so unlike the phone they replace what the directory had. */
  address?: string | null;
  taxId?: string | null;
}) {
  const name = input.name.trim();
  if (!name) return;
  const phone = input.phone?.trim() || null;
  const address = input.address?.trim() || null;
  const taxId = input.taxId?.trim() || null;

  try {
    const existing = await prisma.customer.findFirst({ where: { name } });
    if (!existing) {
      await prisma.customer.create({ data: { name, phone, address, taxId } });
      return;
    }
    // Fill in a phone number the directory didn't have yet; never overwrite one it already has.
    const patch: { phone?: string; address?: string; taxId?: string } = {};
    if (phone && !existing.phone) patch.phone = phone;
    if (address && address !== existing.address) patch.address = address;
    if (taxId && taxId !== existing.taxId) patch.taxId = taxId;
    if (Object.keys(patch).length > 0) await prisma.customer.update({ where: { id: existing.id }, data: patch });
  } catch (err) {
    console.error("upsertCustomerFromBooking failed", err);
  }
}
