/**
 * Availability calendar maths. Everything is plain strings ("yyyy-mm-dd", "HH:mm") in Bangkok wall-clock time, so the
 * same code runs on the server and in the browser without any timezone drift.
 */

export type AvailabilityZone = "RESORT" | "POOL_VILLA" | "BANQUET";

export type AvailabilityResource = { id: string; name: string; zone: AvailabilityZone; sortOrder: number; roomType?: string | null };
export type AvailabilityStay = {
  id: string;
  resourceId: string;
  customerName: string;
  checkIn: string;
  checkOut: string;
  status: "RESERVED" | "CHECKED_IN" | "CHECKED_OUT";
  charterGroupId: string | null;
};
export type AvailabilityEvent = {
  id: string;
  resourceId: string;
  customerName: string;
  date: string;
  start: string;
  end: string;
  status: "RESERVED" | "CONFIRMED";
};

export type AvailabilityInput = {
  resources: AvailabilityResource[];
  /** Cancelled bookings are left out by the caller: they free the room. */
  stays: AvailabilityStay[];
  events: AvailabilityEvent[];
};

export const ZONE_LABELS: Record<AvailabilityZone, string> = { RESORT: "รีสอร์ต", POOL_VILLA: "พูลวิลล่า", BANQUET: "ห้องจัดเลี้ยง" };
export const ZONE_ORDER: AvailabilityZone[] = ["RESORT", "POOL_VILLA", "BANQUET"];

/** A guest sleeps the night of `date` when check-in <= date < check-out (strings compare correctly as yyyy-mm-dd). */
export const staysOn = (s: AvailabilityStay, date: string) => s.checkIn <= date && date < s.checkOut;

export type DaySummary = {
  date: string;
  /** Accommodation rooms occupied that night, of all of them. */
  occupied: number;
  rooms: number;
  /** Percent, 0–100, rounded. */
  rate: number;
  zones: { zone: "RESORT" | "POOL_VILLA"; occupied: number; rooms: number }[];
  /** Banquet rooms with at least one event that day. */
  banquetUsed: number;
  banquetRooms: number;
};

export function summarizeDay(input: AvailabilityInput, date: string): DaySummary {
  const acc = input.resources.filter((r) => r.zone !== "BANQUET");
  const banquet = input.resources.filter((r) => r.zone === "BANQUET");
  const occupiedIds = new Set(input.stays.filter((s) => staysOn(s, date)).map((s) => s.resourceId));
  const eventIds = new Set(input.events.filter((e) => e.date === date).map((e) => e.resourceId));
  const zoneRow = (zone: "RESORT" | "POOL_VILLA") => {
    const rooms = acc.filter((r) => r.zone === zone);
    return { zone, rooms: rooms.length, occupied: rooms.filter((r) => occupiedIds.has(r.id)).length };
  };
  const occupied = acc.filter((r) => occupiedIds.has(r.id)).length;
  return {
    date,
    occupied,
    rooms: acc.length,
    rate: acc.length ? Math.round((occupied / acc.length) * 100) : 0,
    zones: [zoneRow("RESORT"), zoneRow("POOL_VILLA")],
    banquetUsed: banquet.filter((r) => eventIds.has(r.id)).length,
    banquetRooms: banquet.length,
  };
}

export type RoomDay =
  | { kind: "STAY"; resource: AvailabilityResource; stay: AvailabilityStay }
  | { kind: "FREE"; resource: AvailabilityResource; /** A guest leaves this morning, so the room is free tonight. */ checkingOut: AvailabilityStay | null }
  | { kind: "EVENTS"; resource: AvailabilityResource; events: AvailabilityEvent[] }
  | { kind: "BANQUET_FREE"; resource: AvailabilityResource };

export type ZoneDay = { zone: AvailabilityZone; label: string; rooms: RoomDay[]; booked: number; free: number };

/** Every room for one day, grouped into the three sections (resort, pool villas, banquet rooms). */
export function dayDetail(input: AvailabilityInput, date: string): ZoneDay[] {
  const bySort = (a: AvailabilityResource, b: AvailabilityResource) => a.sortOrder - b.sortOrder;
  return ZONE_ORDER.map((zone) => {
    const list = input.resources.filter((r) => r.zone === zone).sort(bySort);
    const rooms: RoomDay[] = list.map((resource) => {
      if (zone === "BANQUET") {
        const events = input.events.filter((e) => e.resourceId === resource.id && e.date === date).sort((a, b) => a.start.localeCompare(b.start));
        return events.length ? { kind: "EVENTS", resource, events } : { kind: "BANQUET_FREE", resource };
      }
      const stay = input.stays.find((s) => s.resourceId === resource.id && staysOn(s, date));
      if (stay) return { kind: "STAY", resource, stay };
      const checkingOut = input.stays.find((s) => s.resourceId === resource.id && s.checkOut === date) ?? null;
      return { kind: "FREE", resource, checkingOut };
    });
    const booked = rooms.filter((r) => r.kind === "STAY" || r.kind === "EVENTS").length;
    return { zone, label: ZONE_LABELS[zone], rooms, booked, free: rooms.length - booked };
  });
}
