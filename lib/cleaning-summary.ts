import { SUPPLY_ITEMS, TRACKED_ITEMS, roomSizeOf, type RoomSize } from "@/lib/housekeeping";

export type SummaryRecord = {
  resourceId: string;
  roomName: string;
  type: "CHECKOUT" | "STAY";
  items: { name: string; category: string | null; quantity: number }[];
};

/** One day's totals for the housekeeper's summary and the counter's table footer. */
export function summarizeCleaning(records: SummaryRecord[]) {
  const roomsBySize: Record<RoomSize, Set<string>> = { SMALL: new Set(), LARGE: new Set(), OTHER: new Set() };
  const allRooms = new Set<string>();
  const supplies: Record<string, number> = {};
  for (const i of [...SUPPLY_ITEMS, ...TRACKED_ITEMS.map((t) => ({ name: t.label }))]) supplies[i.name] = 0;

  let checkoutCleans = 0;
  let stayCleans = 0;
  for (const r of records) {
    roomsBySize[roomSizeOf(r.roomName)].add(r.resourceId);
    allRooms.add(r.resourceId);
    if (r.type === "CHECKOUT") checkoutCleans++;
    else stayCleans++;
    for (const i of r.items) supplies[i.name] = (supplies[i.name] ?? 0) + i.quantity;
  }

  return {
    records: records.length,
    rooms: allRooms.size,
    small: roomsBySize.SMALL.size,
    large: roomsBySize.LARGE.size,
    other: roomsBySize.OTHER.size,
    checkoutCleans,
    stayCleans,
    supplies,
  };
}
