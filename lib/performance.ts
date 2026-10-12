import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseDateOnly, toDateOnlyString, todayDateOnly } from "@/lib/dates";
import { accommodationExpectedTotal, banquetExpectedTotal, extractVat, sumPaid } from "@/lib/payment-calc";

const DAY_MS = 86_400_000;
export const MAX_RANGE_DAYS = 366;

type Num = Prisma.Decimal | number | string | null | undefined;
const n = (v: Num) => (v == null ? 0 : Number(v));

// ---------- Input rows (structural subset of the Prisma rows, so the maths stays testable) ----------

type Entry = { amount: Num; paidAt: Date; method: string };
type AddonRow = { quantity: number; price: Num; description: string | null; service: { name: string } | null };
type Disc = { discountType: "BAHT" | "PERCENT"; discountValue: Num; discountNote: string | null };

export type AccRow = Disc & {
  id: string;
  charterGroupId: string | null;
  resourceId: string;
  source: string;
  status: string;
  checkIn: Date;
  checkOut: Date;
  roomPrice: Num;
  customerName: string;
  addons: AddonRow[];
  payment: { entries: Entry[] } | null;
};

export type BanquetRow = Disc & {
  id: string;
  resourceId: string;
  status: string;
  eventDate: Date;
  startTime: Date;
  endTime: Date;
  eventType: string;
  customerName: string;
  addons: AddonRow[];
  payment: { entries: Entry[] } | null;
};

export type ResourceRow = {
  id: string;
  name: string;
  zone: string;
  type: "ACCOMMODATION" | "BANQUET";
  hourlyPrice: Num;
  dailyPrice: Num;
};

export type PaymentEntryRow = { amount: Num; method: string; accommodation: boolean };

export type PerformanceInput = {
  resources: ResourceRow[];
  accommodation: AccRow[]; // every booking overlapping the range (any status)
  banquet: BanquetRow[]; // every booking with eventDate in range (any status)
  entriesInRange: PaymentEntryRow[];
  /** Normalised names of customers who booked anything before the range (to tell new from returning). */
  priorCustomerNames?: string[];
};

// ---------- Output ----------

export type PerformanceReport = {
  from: string;
  to: string;
  days: number;
  accommodationOcc: {
    rate: number;
    occupiedNights: number;
    capacityNights: number;
    byZone: { zone: string; roomCount: number; occupiedNights: number; capacityNights: number; rate: number }[];
    byRoom: { name: string; zone: string; occupiedNights: number; rate: number }[];
    /** Average rate per priced night (Agoda-style 0-baht rooms are excluded) and room revenue per available night. */
    adr: number;
    revpar: number;
    roomRevenue: number;
  };
  banquetOcc: {
    rate: number;
    usedSlots: number;
    capacitySlots: number;
    roomCount: number;
    bookedHours: number;
    byRoom: { name: string; usedDays: number; events: number; hours: number; rate: number }[];
    byEventType: { type: string; events: number; revenue: number }[];
  };
  /** Revenue recognised on the service date (check-in / event date), net of discount. VAT-inclusive prices. */
  revenue: {
    accommodation: number;
    banquet: number;
    gross: number;
    discount: number;
    net: number;
    exVat: number;
    vat: number;
  };
  /** Cash actually received in the range, by payment date. */
  cash: {
    total: number;
    accommodation: number;
    banquet: number;
    byMethod: { method: string; amount: number }[];
  };
  collection: {
    expected: number;
    paid: number;
    paidRate: number;
    bookings: number;
    withPayment: number;
    withoutPayment: number;
    upcomingBookings: number;
    upcomingWithDeposit: number;
    upcomingExpected: number;
    upcomingPaid: number;
  };
  receivables: { type: "ACCOMMODATION" | "BANQUET"; id: string; customerName: string; date: string; expected: number; paid: number; remaining: number }[];
  receivablesTotal: number;
  discounts: { total: number; bookingsWithDiscount: number; byNote: { note: string; amount: number; count: number }[] };
  cancellations: {
    accommodation: { total: number; cancelled: number; rate: number };
    banquet: { total: number; cancelled: number; rate: number };
  };
  channels: { source: string; bookings: number; revenue: number }[];
  addons: {
    total: number;
    shareOfGross: number;
    attachRate: number;
    bookingsWithAddons: number;
    bookings: number;
    byScope: { accommodation: number; banquet: number };
    items: { name: string; scope: "ACCOMMODATION" | "BANQUET" | "BOTH"; quantity: number; revenue: number; bookings: number }[];
  };
  bookingCounts: { accommodation: number; banquet: number };
  customers: {
    unique: number;
    /** Booked 2+ times within the range. */
    repeat: number;
    /** Also booked before the range started. */
    returning: number;
    newCustomers: number;
    topShare: number;
    top: {
      name: string;
      accommodation: number;
      banquet: number;
      nights: number;
      revenue: number;
      paid: number;
      remaining: number;
      share: number;
      returning: boolean;
    }[];
  };
  /** One entry per day in the range: rooms occupied that night / banquet rooms with an event that day. */
  daily: {
    date: string;
    accOccupied: number;
    accRate: number;
    /** Same figures per accommodation zone (Resort / Pool villa). */
    zones: { zone: string; occupied: number; rooms: number; rate: number }[];
    banquetUsed: number;
    banquetRate: number;
  }[];
};

const clipNights = (checkIn: Date, checkOut: Date, start: Date, end: Date) => {
  const s = checkIn < start ? start : checkIn;
  const e = checkOut > end ? end : checkOut;
  return Math.max(0, Math.round((e.getTime() - s.getTime()) / DAY_MS));
};

const pct = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0);
const round2 = (v: number) => Math.round(v * 100) / 100;

export function computePerformance(input: PerformanceInput, from: string, to: string): PerformanceReport {
  const start = parseDateOnly(from);
  const end = new Date(parseDateOnly(to).getTime() + DAY_MS); // exclusive
  const days = Math.round((end.getTime() - start.getTime()) / DAY_MS);
  const today = todayDateOnly();

  const accRooms = input.resources.filter((r) => r.type === "ACCOMMODATION");
  const banquetRooms = input.resources.filter((r) => r.type === "BANQUET");
  const resourceById = new Map(input.resources.map((r) => [r.id, r]));

  const accActive = input.accommodation.filter((b) => b.status !== "CANCELLED");
  const banquetActive = input.banquet.filter((b) => b.status !== "CANCELLED");
  // Service-date basis: a booking belongs to the range of its check-in / event date.
  const accInRange = accActive.filter((b) => b.checkIn >= start && b.checkIn < end);

  // ----- accommodation occupancy -----
  const nightsByRoom = new Map<string, number>();
  let pricedNights = 0;
  let roomRevenue = 0;
  for (const b of accActive) {
    const nights = clipNights(b.checkIn, b.checkOut, start, end);
    nightsByRoom.set(b.resourceId, (nightsByRoom.get(b.resourceId) ?? 0) + nights);
    const price = n(b.roomPrice);
    roomRevenue += nights * price;
    if (price > 0) pricedNights += nights;
  }
  const occupiedNights = Array.from(nightsByRoom.values()).reduce((a, b) => a + b, 0);
  const capacityNights = accRooms.length * days;
  const zones = Array.from(new Set(accRooms.map((r) => r.zone)));
  const byZone = zones.map((zone) => {
    const rooms = accRooms.filter((r) => r.zone === zone);
    const occ = rooms.reduce((s, r) => s + (nightsByRoom.get(r.id) ?? 0), 0);
    const cap = rooms.length * days;
    return { zone, roomCount: rooms.length, occupiedNights: occ, capacityNights: cap, rate: pct(occ, cap) };
  });
  const accByRoom = accRooms
    .map((r) => ({ name: r.name, zone: r.zone, occupiedNights: nightsByRoom.get(r.id) ?? 0, rate: pct(nightsByRoom.get(r.id) ?? 0, days) }))
    .sort((a, b) => b.rate - a.rate);

  // ----- banquet occupancy: one room can host one event slot per day -----
  const slots = new Set<string>();
  const roomStats = new Map<string, { days: Set<string>; events: number; hours: number }>();
  let bookedHours = 0;
  for (const b of banquetActive) {
    const day = toDateOnlyString(b.eventDate);
    slots.add(`${b.resourceId}|${day}`);
    const hours = Math.max(0, (b.endTime.getTime() - b.startTime.getTime()) / 3_600_000);
    bookedHours += hours;
    const st = roomStats.get(b.resourceId) ?? { days: new Set<string>(), events: 0, hours: 0 };
    st.days.add(day);
    st.events += 1;
    st.hours += hours;
    roomStats.set(b.resourceId, st);
  }
  const capacitySlots = banquetRooms.length * days;
  const banquetByRoom = banquetRooms
    .map((r) => {
      const st = roomStats.get(r.id);
      return { name: r.name, usedDays: st?.days.size ?? 0, events: st?.events ?? 0, hours: st?.hours ?? 0, rate: pct(st?.days.size ?? 0, days) };
    })
    .sort((a, b) => b.rate - a.rate);

  // ----- per-booking totals (service-date basis) -----
  type Priced = { gross: number; discount: number; net: number; paid: number; addons: AddonRow[]; note: string; hasDiscount: boolean };
  const priceAcc = (b: AccRow): Priced => {
    const t = accommodationExpectedTotal(b, b.addons);
    return {
      gross: t.subtotal,
      discount: t.discountAmount,
      net: t.expectedTotal,
      paid: sumPaid(b.payment?.entries ?? []),
      addons: b.addons,
      note: b.discountNote ?? "",
      hasDiscount: t.discountAmount > 0,
    };
  };
  const priceBanquet = (b: BanquetRow): Priced => {
    const r = resourceById.get(b.resourceId);
    const t = banquetExpectedTotal(b, { hourlyPrice: r?.hourlyPrice, dailyPrice: r?.dailyPrice }, b.addons, {
      type: b.discountType,
      value: b.discountValue,
    });
    return {
      gross: t.subtotal,
      discount: t.discountAmount,
      net: t.expectedTotal,
      paid: sumPaid(b.payment?.entries ?? []),
      addons: b.addons,
      note: b.discountNote ?? "",
      hasDiscount: t.discountAmount > 0,
    };
  };

  const accPriced = accInRange.map((b) => ({ row: b, p: priceAcc(b) }));
  const banquetPriced = banquetActive.map((b) => ({ row: b, p: priceBanquet(b) }));
  const all = [...accPriced.map((x) => x.p), ...banquetPriced.map((x) => x.p)];

  const accRevenue = accPriced.reduce((s, x) => s + x.p.net, 0);
  const banquetRevenue = banquetPriced.reduce((s, x) => s + x.p.net, 0);
  const gross = all.reduce((s, p) => s + p.gross, 0);
  const discount = all.reduce((s, p) => s + p.discount, 0);
  const net = accRevenue + banquetRevenue;
  const { exVat, vat } = extractVat(net);

  // ----- cash basis -----
  const methodMap = new Map<string, number>();
  let cashAcc = 0;
  let cashBanquet = 0;
  for (const e of input.entriesInRange) {
    const amt = n(e.amount);
    methodMap.set(e.method, (methodMap.get(e.method) ?? 0) + amt);
    if (e.accommodation) cashAcc += amt;
    else cashBanquet += amt;
  }

  // ----- collection / deposit -----
  const expected = net;
  const paid = all.reduce((s, p) => s + p.paid, 0);
  const withPayment = all.filter((p) => p.paid > 0).length;
  const upcoming = [
    ...accPriced.filter((x) => x.row.checkIn >= today).map((x) => x.p),
    ...banquetPriced.filter((x) => x.row.eventDate >= today).map((x) => x.p),
  ];

  const receivables = [
    ...accPriced
      .filter((x) => x.row.checkIn <= today)
      .map((x) => ({ type: "ACCOMMODATION" as const, id: x.row.id, customerName: x.row.customerName, date: toDateOnlyString(x.row.checkIn), p: x.p })),
    ...banquetPriced
      .filter((x) => x.row.eventDate <= today)
      .map((x) => ({ type: "BANQUET" as const, id: x.row.id, customerName: x.row.customerName, date: toDateOnlyString(x.row.eventDate), p: x.p })),
  ]
    .map(({ p, ...r }) => ({ ...r, expected: p.net, paid: p.paid, remaining: round2(p.net - p.paid) }))
    .filter((r) => r.remaining > 0.005)
    .sort((a, b) => b.remaining - a.remaining);

  // ----- discounts -----
  const noteMap = new Map<string, { amount: number; count: number }>();
  for (const p of all) {
    if (!p.hasDiscount) continue;
    const key = p.note.trim() || "(ไม่ระบุหมายเหตุ)";
    const cur = noteMap.get(key) ?? { amount: 0, count: 0 };
    cur.amount += p.discount;
    cur.count += 1;
    noteMap.set(key, cur);
  }

  // ----- cancellations (a charter group counts once) -----
  const groups = (rows: AccRow[]) => new Set(rows.map((b) => b.charterGroupId ?? b.id)).size;
  const accStartInRange = input.accommodation.filter((b) => b.checkIn >= start && b.checkIn < end);
  const accTotal = groups(accStartInRange);
  const accCancelled = groups(accStartInRange.filter((b) => b.status === "CANCELLED"));
  const bTotal = input.banquet.length;
  const bCancelled = input.banquet.filter((b) => b.status === "CANCELLED").length;

  // ----- channels -----
  const chan = new Map<string, { groups: Set<string>; revenue: number }>();
  for (const x of accPriced) {
    const c = chan.get(x.row.source) ?? { groups: new Set<string>(), revenue: 0 };
    c.groups.add(x.row.charterGroupId ?? x.row.id);
    c.revenue += x.p.net;
    chan.set(x.row.source, c);
  }

  // ----- add-ons -----
  type Item = { name: string; scopes: Set<"ACCOMMODATION" | "BANQUET">; quantity: number; revenue: number; bookings: Set<string> };
  const itemMap = new Map<string, Item>();
  let addonTotalAcc = 0;
  let addonTotalBanquet = 0;
  let bookingsWithAddons = 0;
  const addTo = (scope: "ACCOMMODATION" | "BANQUET", bookingKey: string, addons: AddonRow[]) => {
    if (addons.length > 0) bookingsWithAddons += 1;
    for (const a of addons) {
      const name = a.service?.name || a.description || "-";
      const revenue = a.quantity * n(a.price);
      const it = itemMap.get(name) ?? { name, scopes: new Set(), quantity: 0, revenue: 0, bookings: new Set<string>() };
      it.scopes.add(scope);
      it.quantity += a.quantity;
      it.revenue += revenue;
      it.bookings.add(bookingKey);
      itemMap.set(name, it);
      if (scope === "ACCOMMODATION") addonTotalAcc += revenue;
      else addonTotalBanquet += revenue;
    }
  };
  for (const x of accPriced) addTo("ACCOMMODATION", `A${x.row.id}`, x.row.addons);
  for (const x of banquetPriced) addTo("BANQUET", `B${x.row.id}`, x.row.addons);
  const addonTotal = addonTotalAcc + addonTotalBanquet;
  const bookingTotal = accPriced.length + banquetPriced.length;

  // ----- customers (grouped by trimmed name; the booking forms store free-text names) -----
  const normName = (v: string) => v.trim().replace(/\s+/g, " ");
  const prior = new Set((input.priorCustomerNames ?? []).map(normName));
  type Cust = { name: string; acc: Set<string>; banquet: number; nights: number; revenue: number; paid: number };
  const custMap = new Map<string, Cust>();
  const cust = (name: string) => {
    const key = normName(name);
    const c = custMap.get(key) ?? { name: key, acc: new Set<string>(), banquet: 0, nights: 0, revenue: 0, paid: 0 };
    custMap.set(key, c);
    return c;
  };
  for (const x of accPriced) {
    const c = cust(x.row.customerName);
    c.acc.add(x.row.charterGroupId ?? x.row.id);
    c.nights += Math.max(0, Math.round((x.row.checkOut.getTime() - x.row.checkIn.getTime()) / DAY_MS));
    c.revenue += x.p.net;
    c.paid += x.p.paid;
  }
  for (const x of banquetPriced) {
    const c = cust(x.row.customerName);
    c.banquet += 1;
    c.revenue += x.p.net;
    c.paid += x.p.paid;
  }
  const custs = Array.from(custMap.values());
  const topCusts = custs.sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  const custReturning = custs.filter((c) => prior.has(c.name)).length;

  // ----- event types -----
  const typeMap = new Map<string, { events: number; revenue: number }>();
  for (const x of banquetPriced) {
    const cur = typeMap.get(x.row.eventType) ?? { events: 0, revenue: 0 };
    cur.events += 1;
    cur.revenue += x.p.net;
    typeMap.set(x.row.eventType, cur);
  }

  const daily: PerformanceReport["daily"] = [];
  for (let i = 0; i < days; i++) {
    const day = new Date(start.getTime() + i * DAY_MS);
    const key = toDateOnlyString(day);
    const stays = accActive.filter((b) => b.checkIn <= day && b.checkOut > day);
    const accOccupied = stays.length;
    const zoneStats = zones.map((zone) => {
      const rooms = accRooms.filter((r) => r.zone === zone);
      const ids = new Set(rooms.map((r) => r.id));
      const occupied = stays.filter((b) => ids.has(b.resourceId)).length;
      return { zone, occupied, rooms: rooms.length, rate: pct(occupied, rooms.length) };
    });
    const banquetUsed = new Set(banquetActive.filter((b) => toDateOnlyString(b.eventDate) === key).map((b) => b.resourceId)).size;
    daily.push({
      date: key,
      accOccupied,
      accRate: pct(accOccupied, accRooms.length),
      zones: zoneStats,
      banquetUsed,
      banquetRate: pct(banquetUsed, banquetRooms.length),
    });
  }

  return {
    from,
    to,
    days,
    daily,
    customers: {
      unique: custs.length,
      repeat: custs.filter((c) => c.acc.size + c.banquet >= 2).length,
      returning: custReturning,
      newCustomers: custs.length - custReturning,
      topShare: pct(topCusts.reduce((sum, c) => sum + c.revenue, 0), net),
      top: topCusts.map((c) => ({
        name: c.name,
        accommodation: c.acc.size,
        banquet: c.banquet,
        nights: c.nights,
        revenue: c.revenue,
        paid: c.paid,
        remaining: Math.max(0, round2(c.revenue - c.paid)),
        share: pct(c.revenue, net),
        returning: prior.has(c.name),
      })),
    },
    accommodationOcc: {
      rate: pct(occupiedNights, capacityNights),
      occupiedNights,
      capacityNights,
      byZone,
      byRoom: accByRoom,
      adr: pricedNights > 0 ? roomRevenue / pricedNights : 0,
      revpar: capacityNights > 0 ? roomRevenue / capacityNights : 0,
      roomRevenue,
    },
    banquetOcc: {
      rate: pct(slots.size, capacitySlots),
      usedSlots: slots.size,
      capacitySlots,
      roomCount: banquetRooms.length,
      bookedHours,
      byRoom: banquetByRoom,
      byEventType: Array.from(typeMap.entries()).map(([type, v]) => ({ type, ...v })).sort((a, b) => b.revenue - a.revenue),
    },
    revenue: { accommodation: accRevenue, banquet: banquetRevenue, gross, discount, net, exVat, vat },
    cash: {
      total: cashAcc + cashBanquet,
      accommodation: cashAcc,
      banquet: cashBanquet,
      byMethod: Array.from(methodMap.entries()).map(([method, amount]) => ({ method, amount })).sort((a, b) => b.amount - a.amount),
    },
    collection: {
      expected,
      paid,
      paidRate: pct(paid, expected),
      bookings: all.length,
      withPayment,
      withoutPayment: all.length - withPayment,
      upcomingBookings: upcoming.length,
      upcomingWithDeposit: upcoming.filter((p) => p.paid > 0).length,
      upcomingExpected: upcoming.reduce((s, p) => s + p.net, 0),
      upcomingPaid: upcoming.reduce((s, p) => s + p.paid, 0),
    },
    receivables: receivables.slice(0, 10),
    receivablesTotal: receivables.reduce((s, r) => s + r.remaining, 0),
    discounts: {
      total: discount,
      bookingsWithDiscount: all.filter((p) => p.hasDiscount).length,
      byNote: Array.from(noteMap.entries()).map(([note, v]) => ({ note, ...v })).sort((a, b) => b.amount - a.amount),
    },
    cancellations: {
      accommodation: { total: accTotal, cancelled: accCancelled, rate: pct(accCancelled, accTotal) },
      banquet: { total: bTotal, cancelled: bCancelled, rate: pct(bCancelled, bTotal) },
    },
    channels: Array.from(chan.entries())
      .map(([source, v]) => ({ source, bookings: v.groups.size, revenue: v.revenue }))
      .sort((a, b) => b.revenue - a.revenue),
    addons: {
      total: addonTotal,
      shareOfGross: pct(addonTotal, gross),
      attachRate: pct(bookingsWithAddons, bookingTotal),
      bookingsWithAddons,
      bookings: bookingTotal,
      byScope: { accommodation: addonTotalAcc, banquet: addonTotalBanquet },
      items: Array.from(itemMap.values())
        .map((it) => ({
          name: it.name,
          scope: (it.scopes.size > 1 ? "BOTH" : Array.from(it.scopes)[0]) as "ACCOMMODATION" | "BANQUET" | "BOTH",
          quantity: it.quantity,
          revenue: it.revenue,
          bookings: it.bookings.size,
        }))
        .sort((a, b) => b.revenue - a.revenue),
    },
    // Charter groups count once.
    bookingCounts: { accommodation: groups(accInRange), banquet: banquetActive.length },
  };
}

// ---------- Range helpers ----------

export function monthBounds(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Valid, ordered, bounded range from the query string; falls back to the given default month. */
export function resolveRange(params: { from?: string; to?: string; month?: string }, defaultMonth: string) {
  const fallback = monthBounds(params.month && /^\d{4}-\d{2}$/.test(params.month) ? params.month : defaultMonth);
  if (!params.from || !params.to || !DATE_RE.test(params.from) || !DATE_RE.test(params.to)) return fallback;
  if (params.from > params.to) return fallback;
  const spanDays = Math.round((parseDateOnly(params.to).getTime() - parseDateOnly(params.from).getTime()) / DAY_MS) + 1;
  if (spanDays > MAX_RANGE_DAYS) return fallback;
  return { from: params.from, to: params.to };
}

/** The equally long range immediately before [from, to]. */
export function previousRange(from: string, to: string): { from: string; to: string } {
  const f = parseDateOnly(from).getTime();
  const t = parseDateOnly(to).getTime();
  const len = t - f + DAY_MS;
  return { from: toDateOnlyString(new Date(f - len)), to: toDateOnlyString(new Date(f - DAY_MS)) };
}

// ---------- Loading ----------

export async function loadPerformance(from: string, to: string): Promise<PerformanceReport> {
  const start = parseDateOnly(from);
  const end = new Date(parseDateOnly(to).getTime() + DAY_MS);

  const [resources, accommodation, banquet, entries, priorAcc, priorBanquet] = await Promise.all([
    prisma.resource.findMany({
      where: { type: { in: ["ACCOMMODATION", "BANQUET"] } },
      select: { id: true, name: true, zone: true, type: true, hourlyPrice: true, dailyPrice: true },
    }),
    prisma.accommodationBooking.findMany({
      where: { checkIn: { lt: end }, checkOut: { gt: start } },
      include: { addons: { include: { service: true } }, payment: { include: { entries: true } } },
    }),
    prisma.banquetBooking.findMany({
      where: { eventDate: { gte: start, lt: end } },
      include: { addons: { include: { service: true } }, payment: { include: { entries: true } } },
    }),
    prisma.paymentEntry.findMany({
      where: { paidAt: { gte: start, lt: end } },
      select: { amount: true, method: true, payment: { select: { accommodationBookingId: true } } },
    }),
    prisma.accommodationBooking.findMany({
      where: { checkIn: { lt: start }, status: { not: "CANCELLED" } },
      select: { customerName: true },
      distinct: ["customerName"],
    }),
    prisma.banquetBooking.findMany({
      where: { eventDate: { lt: start }, status: { not: "CANCELLED" } },
      select: { customerName: true },
      distinct: ["customerName"],
    }),
  ]);

  return computePerformance(
    {
      resources: resources as ResourceRow[],
      accommodation: accommodation as unknown as AccRow[],
      banquet: banquet as unknown as BanquetRow[],
      entriesInRange: entries.map((e) => ({
        amount: e.amount,
        method: e.method,
        accommodation: e.payment.accommodationBookingId != null,
      })),
      priorCustomerNames: [...priorAcc, ...priorBanquet].map((b) => b.customerName),
    },
    from,
    to
  );
}
