import type { prisma } from "@/lib/prisma";
import { TRACKED_ITEMS, trackedKeyForAddonName, type TrackedKey } from "@/lib/housekeeping";

/** Services the housekeeper's record turns into a charge on the booking (the pet fee is still left to the cashier). */
const BILLED_KEYS: TrackedKey[] = ["EXTRA_BED", "BLANKET", "PILLOW", "HOURLY"];

/** Marks an add-on the system created from a housekeeper's record; the label after it says which service. */
const AUTO_PREFIX = "แม่บ้านบันทึก";

const isAuto = (description: string | null) => !!description && description.startsWith(AUTO_PREFIX);

type Db = Pick<typeof prisma, "accommodationBooking" | "accommodationAddon" | "cleaningRecordItem" | "specialService">;

/**
 * Brings the booking's add-ons in line with what the housekeeper recorded for the stay covering (room, ledger date):
 * extra bed, blanket, pillow and late-checkout hours. What she finds or hands out shows up in the booking total the
 * cashier collects.
 *
 * The stay is the one with checkIn <= ledgerDate < checkOut — the same rule the audit uses — and each record row counts
 * once (an extra bed recorded on three nights' cleanings is three), as the paper log's amount column does. Units the
 * cashier already billed by hand are left alone and only the shortfall is added, as a separate add-on tagged with
 * AUTO_PREFIX; that one is raised, lowered or removed when the housekeeper's record is corrected. If the tag is lost
 * (the booking form re-saves its add-ons) the add-on simply counts as billed by hand, so nothing is ever charged twice.
 * Call it inside the transaction that saves the record, for every (room, date) the change touches.
 */
export async function syncHousekeepingBilling(db: Db, resourceId: string, ledgerDate: Date) {
  const booking = await db.accommodationBooking.findFirst({
    where: { resourceId, status: { not: "CANCELLED" }, checkIn: { lte: ledgerDate }, checkOut: { gt: ledgerDate } },
    include: { addons: { include: { service: true } }, resource: { select: { zone: true } } },
  });
  if (!booking) return;

  const items = await db.cleaningRecordItem.findMany({
    where: {
      category: { in: BILLED_KEYS },
      record: { resourceId, ledgerDate: { gte: booking.checkIn, lt: booking.checkOut } },
    },
    select: { category: true, quantity: true },
  });
  const services = await db.specialService.findMany({ where: { scope: "ACCOMMODATION" } });
  // The resort and the pool villas have their own hourly services; prefer the one for this room's zone.
  const zoneWord = booking.resource.zone === "POOL_VILLA" ? "พูลวิลล่า" : "รีสอร์ท";

  for (const key of BILLED_KEYS) {
    const taken = items.filter((i) => i.category === key).reduce((s, i) => s + i.quantity, 0);
    const billed = booking.addons.filter((a) => trackedKeyForAddonName(a.service?.name ?? a.description) === key);
    const manual = billed.filter((a) => !isAuto(a.description)).reduce((s, a) => s + a.quantity, 0);
    const autoAddons = billed.filter((a) => isAuto(a.description));
    const target = Math.max(0, taken - manual);
    if (autoAddons.reduce((s, a) => s + a.quantity, 0) === target) continue;

    if (target === 0) {
      await db.accommodationAddon.deleteMany({ where: { id: { in: autoAddons.map((a) => a.id) } } });
      continue;
    }
    if (autoAddons.length > 0) {
      const [keep, ...extra] = autoAddons;
      await db.accommodationAddon.update({ where: { id: keep.id }, data: { quantity: target } });
      if (extra.length > 0) await db.accommodationAddon.deleteMany({ where: { id: { in: extra.map((a) => a.id) } } });
      continue;
    }

    const matches = services.filter((s) => trackedKeyForAddonName(s.name) === key);
    const service = matches.find((s) => s.name.includes(zoneWord)) ?? matches[0];
    const label = TRACKED_ITEMS.find((t) => t.key === key)?.label ?? key;
    await db.accommodationAddon.create({
      data: {
        bookingId: booking.id,
        serviceId: service?.id ?? null,
        description: `${AUTO_PREFIX}: ${label}`,
        quantity: target,
        price: service ? service.price : 0,
      },
    });
  }
}
