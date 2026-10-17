/**
 * Supplies a housekeeper can record taking out for a room. The "tracked" ones are also billed as
 * add-ons (see the seeded special services), so the review page checks what was taken out against
 * what the booking was charged for. Matching billed add-ons to a tracked key is by name keyword,
 * since add-on names are free text the admin can edit.
 */
export const TRACKED_ITEMS = [
  { key: "EXTRA_BED", label: "เตียงเสริม", keywords: ["เตียงเสริม"] },
  { key: "BLANKET", label: "ผ้าห่มเพิ่ม", keywords: ["ผ้าห่ม"] },
  { key: "PILLOW", label: "หมอนเพิ่ม", keywords: ["หมอน"] },
  { key: "PET", label: "สัตว์เลี้ยง", keywords: ["สัตว์เลี้ยง", "สุนัข", "แมว"] },
] as const;

export type TrackedKey = (typeof TRACKED_ITEMS)[number]["key"];

export const TRACKED_KEYS: string[] = TRACKED_ITEMS.map((t) => t.key);

export const TRACKED_LABELS: Record<string, string> = Object.fromEntries(TRACKED_ITEMS.map((t) => [t.key, t.label]));

/** Ordinary consumables — recorded for stock tracking only, not audited against billing. */
export const SUPPLY_ITEMS = ["ผ้าเช็ดตัว", "ผ้าปูที่นอน", "ปลอกหมอน", "น้ำดื่ม", "ชุดสบู่/แชมพู"] as const;

export const CLEANING_TYPE_LABELS: Record<string, string> = {
  CHECKOUT: "ลูกค้าเช็คเอาท์",
  STAY: "ระหว่างเข้าพัก",
};

export function trackedKeyForAddonName(name: string | null | undefined): TrackedKey | null {
  if (!name) return null;
  return TRACKED_ITEMS.find((t) => t.keywords.some((k) => name.includes(k)))?.key ?? null;
}
