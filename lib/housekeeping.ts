/**
 * Supplies a housekeeper can record taking out for a room. The "tracked" ones are also billed as
 * add-ons (see the seeded special services), so the review page checks what was taken out against
 * what the booking was charged for. Matching billed add-ons to a tracked key is by name keyword,
 * since add-on names are free text the admin can edit.
 */
export const TRACKED_ITEMS = [
  { key: "EXTRA_BED", label: "เตียงเสริม", unit: "", hint: "ระบบจะเพิ่มเข้ายอดของการจองให้อัตโนมัติ (คิดครั้งเดียวต่อการเข้าพัก)", keywords: ["เตียงเสริม", "ที่นอนเสริม"] },
  { key: "BLANKET", label: "ผ้าห่มเพิ่ม", unit: "", hint: "ระบบจะเพิ่มเข้ายอดของการจองให้อัตโนมัติ (คิดครั้งเดียวต่อการเข้าพัก)", keywords: ["ผ้าห่ม"] },
  { key: "PILLOW", label: "หมอนเพิ่ม", unit: "", hint: "ระบบจะเพิ่มเข้ายอดของการจองให้อัตโนมัติ (คิดครั้งเดียวต่อการเข้าพัก)", keywords: ["หมอน"] },
  { key: "PET", label: "สัตว์เลี้ยง", unit: "", hint: "ระบบจะเพิ่มเข้ายอดของการจองให้อัตโนมัติ (คิดครั้งเดียวต่อการเข้าพัก)", keywords: ["สัตว์เลี้ยง", "สุนัข", "แมว"] },
  // Late checkout found by the housekeeper: the quantity is the hours over, billed per hour (see the "ค่าต่อชั่วโมง…" services).
  { key: "HOURLY", label: "ค่าต่อชั่วโมง", unit: "ชั่วโมง", hint: "ลูกค้าเช็คเอาท์เลท — ใส่จำนวนชั่วโมงที่เกินเวลา ระบบจะเพิ่มเข้ายอดของการจองให้แคชเชียร์เก็บเงินอัตโนมัติ", keywords: ["ต่อชั่วโมง"] },
  // Laundry has no unit count, so the housekeeper enters the amount in baht (stored in the item's quantity).
  { key: "LAUNDRY", label: "บริการซักผ้า", unit: "บาท", hint: "ใส่จำนวนเงิน (บาท) ระบบจะเพิ่มเข้ายอดของการจองให้อัตโนมัติ", keywords: ["ซักผ้า"] },
] as const;

/** Services whose recorded quantity is an amount in baht rather than a count. */
export const AMOUNT_KEYS: string[] = ["LAUNDRY"];

export type TrackedKey = (typeof TRACKED_ITEMS)[number]["key"];

export const TRACKED_KEYS: string[] = TRACKED_ITEMS.map((t) => t.key);

export const TRACKED_LABELS: Record<string, string> = Object.fromEntries(TRACKED_ITEMS.map((t) => [t.key, t.label]));

/** The consumables on the paper "บัญชีคุมการทำความสะอาดและเบิกวัสดุสิ้นเปลือง" log, in its column order.
 *  Recorded for stock tracking only — not audited against billing. */
export const SUPPLY_ITEMS = [
  { name: "น้ำดื่ม", unit: "ขวด" },
  { name: "กาแฟ", unit: "ซอง" },
  { name: "สบู่", unit: "ขวด" },
  { name: "แชมพู", unit: "ขวด" },
  { name: "ทิชชู่", unit: "ม้วน" },
  { name: "หมวก", unit: "ชิ้น" },
  { name: "ถุงขยะ", unit: "ใบ" },
  { name: "ถุงใส่ผ้าอนามัย", unit: "ใบ" },
] as const;

export type RoomSize = "SMALL" | "LARGE" | "OTHER";

export const ROOM_SIZE_LABELS: Record<RoomSize, string> = { SMALL: "ห้องเล็ก", LARGE: "ห้องใหญ่", OTHER: "ห้องอื่นๆ" };

/** Resort rooms carry their size in the name ("ห้อง 1 เล็ก", "ห้อง 3 ใหญ่ (คู่)", "B2 เล็ก"); pool villas have none. */
export function roomSizeOf(name: string): RoomSize {
  if (name.includes("เล็ก")) return "SMALL";
  if (name.includes("ใหญ่")) return "LARGE";
  return "OTHER";
}

/** Short label for a table cell: the room number/code without the size suffix. */
export function roomShortName(name: string): string {
  return name.replace(/^ห้อง\s*/, "").replace(/\s*(เล็ก|ใหญ่).*$/, "").trim() || name;
}

export const CLEANING_TYPE_LABELS: Record<string, string> = {
  CHECKOUT: "ลูกค้าเช็คเอาท์",
  STAY: "ลูกค้าพักต่อ",
};

export function trackedKeyForAddonName(name: string | null | undefined): TrackedKey | null {
  if (!name) return null;
  return TRACKED_ITEMS.find((t) => t.keywords.some((k) => name.includes(k)))?.key ?? null;
}
