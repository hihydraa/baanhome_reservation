import type { prisma } from "@/lib/prisma";
import { trackedKeyForAddonName } from "@/lib/housekeeping";

/** Marks an add-on the system created from the housekeeper's late-checkout record (kept in `description`). */
export const AUTO_ADDON_TAG = "แม่บ้านบันทึก (เช็คเอาท์เลท)";

const isAuto = (description: string | null) => !!description && description.startsWith("แม่บ้านบันทึก");

type Db = Pick<typeof prisma, "accommodationBooking" | "accommodationAddon" | "cleaningRecordItem" | "specialService">;

/**
 * Brings the hourly add-on of the stay covering (room, ledger date) in line with the hours the housekeeper recorded,
 * so a late checkout she finds shows up in the booking total the cashier collects.
 *
 * The stay is the one with checkIn <= ledgerDate < checkOut — the same rule the audit uses. Hours the cashier already
 * billed by hand are left alone and only the shortfall is added, as a separate add-on tagged AUTO_ADDON_TAG; that one
 * is raised, lowered or removed when the housekeeper's record is corrected. If the tag is lost (the booking form
 * re-saves its add-ons) the add-on simply counts as billed by hand, so nothing is ever charged twice.
 * Call it inside the transaction that saves the record, for every (room, date) the change touches.
 */
export async function syncLateCheckoutBilling(db: Db, resourceId: string, ledgerDate: Date) {
  const booking = await db.accommodationBooking.findFirst({
    where: { resourceId, status: { not: "CANCELLED" }, checkIn: { lte: ledgerDate }, checkOut: { gt: ledgerDate } },
    include: { addons: { include: { service: true } }, resource: { select: { zone: true } } },
  });
  if (!booking) return;

  const items = await db.cleaningRecordItem.findMany({
    where: {
      category: "HOURLY",
      record: { resourceId, ledgerDate: { gte: booking.checkIn, lt: booking.checkOut } },
    },
    select: { quantity: true },
  });
  const taken = items.reduce((s, i) => s + i.quantity, 0);

  const hourly = booking.addons.filter((a) => trackedKeyForAddonName(a.service?.name ?? a.description) === "HOURLY");
  const manual = hourly.filter((a) => !isAuto(a.description)).reduce((s, a) => s + a.quantity, 0);
  const autoAddons = hourly.filter((a) => isAuto(a.description));
  const target = Math.max(0, taken - manual);

  const current = autoAddons.reduce((s, a) => s + a.quantity, 0);
  if (current === target) return;

  if (target === 0) {
    await db.accommodationAddon.deleteMany({ where: { id: { in: autoAddons.map((a) => a.id) } } });
    return;
  }

  if (autoAddons.length > 0) {
    const [keep, ...extra] = autoAddons;
    await db.accommodationAddon.update({ where: { id: keep.id }, data: { quantity: target } });
    if (extra.length > 0) await db.accommodationAddon.deleteMany({ where: { id: { in: extra.map((a) => a.id) } } });
    return;
  }

  // The rate depends on the zone: the resort and the pool villas have their own hourly services.
  const services = await db.specialService.findMany({ where: { scope: "ACCOMMODATION", name: { contains: "ต่อชั่วโมง" } } });
  const zoneWord = booking.resource.zone === "POOL_VILLA" ? "พูลวิลล่า" : "รีสอร์ท";
  const service = services.find((s) => s.name.includes(zoneWord)) ?? services[0];
  await db.accommodationAddon.create({
    data: {
      bookingId: booking.id,
      serviceId: service?.id ?? null,
      description: AUTO_ADDON_TAG,
      quantity: target,
      price: service ? service.price : 0,
    },
  });
}
