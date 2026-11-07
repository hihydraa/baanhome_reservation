import { AMOUNT_KEYS, SUPPLY_ITEMS, TRACKED_ITEMS } from "@/lib/housekeeping";

export type SupplyRecord = {
  id: string;
  resourceId: string;
  items: { name: string; category: string | null; quantity: number }[];
};

export type SupplyRow = {
  name: string;
  unit: string;
  /** Consumable, billable service (extra bed, laundry…) or a free-text item the housekeeper typed. */
  kind: "SUPPLY" | "SERVICE" | "OTHER";
  total: number;
  /** Cleanings that took it out, and the distinct rooms they were in. */
  cleanings: number;
  rooms: number;
  /** Laundry is an amount in baht, so its total is money, not a count. */
  isAmount: boolean;
};

/**
 * What was taken out over a set of cleaning records, one row per item: consumables first in the paper log's column
 * order, then the billable services, then anything typed in by hand (alphabetical). Items nobody took are left out.
 */
export function summarizeSupplies(records: SupplyRecord[]): SupplyRow[] {
  const acc = new Map<string, { total: number; cleanings: Set<string>; rooms: Set<string>; category: string | null }>();
  for (const r of records) {
    for (const i of r.items) {
      const cur = acc.get(i.name) ?? { total: 0, cleanings: new Set<string>(), rooms: new Set<string>(), category: i.category };
      cur.total += i.quantity;
      cur.cleanings.add(r.id);
      cur.rooms.add(r.resourceId);
      acc.set(i.name, cur);
    }
  }

  const rows: SupplyRow[] = [];
  const take = (name: string, unit: string, kind: SupplyRow["kind"]) => {
    const a = acc.get(name);
    if (!a) return;
    rows.push({
      name,
      unit,
      kind,
      total: a.total,
      cleanings: a.cleanings.size,
      rooms: a.rooms.size,
      isAmount: !!a.category && AMOUNT_KEYS.includes(a.category),
    });
    acc.delete(name);
  };
  for (const s of SUPPLY_ITEMS) take(s.name, s.unit, "SUPPLY");
  for (const t of TRACKED_ITEMS) take(t.label, t.unit, "SERVICE");
  for (const name of [...acc.keys()].sort((a, b) => a.localeCompare(b, "th"))) take(name, "", "OTHER");
  return rows;
}
