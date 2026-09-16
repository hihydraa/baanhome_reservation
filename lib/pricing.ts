/**
 * Reference price list for accommodation rooms and banquet rooms.
 * Sourced from the resort's official rate sheet; update here when rates change.
 */

export type AccommodationPriceRow = {
  zone: "RESORT" | "POOL_VILLA";
  name: string;
  price: number;
};

export const ACCOMMODATION_PRICE_LIST: AccommodationPriceRow[] = [
  { zone: "RESORT", name: "ห้อง 1 เล็ก", price: 590 },
  { zone: "RESORT", name: "ห้อง 2 เล็ก", price: 590 },
  { zone: "RESORT", name: "ห้อง 3 ใหญ่ (คู่)", price: 790 },
  { zone: "RESORT", name: "ห้อง 4 ใหญ่ (เดี่ยว)", price: 790 },
  { zone: "RESORT", name: "ห้อง 5 ใหญ่ (คู่)", price: 790 },
  { zone: "RESORT", name: "ห้อง 6 ใหญ่ (เดี่ยว)", price: 790 },
  { zone: "RESORT", name: "ห้อง 7 ใหญ่ (คู่)", price: 790 },
  { zone: "RESORT", name: "ห้อง 8 ใหญ่ (คู่)", price: 790 },
  { zone: "RESORT", name: "ห้อง 9 ใหญ่ (เดี่ยว)", price: 790 },
  { zone: "RESORT", name: "ห้อง 10 ใหญ่ (เดี่ยว)", price: 790 },
  { zone: "RESORT", name: "ห้อง 11 เล็ก", price: 590 },
  { zone: "RESORT", name: "ห้อง 12 เล็ก", price: 590 },
  { zone: "RESORT", name: "B1 เล็ก", price: 590 },
  { zone: "RESORT", name: "B2 เล็ก", price: 590 },
  { zone: "RESORT", name: "B3 เล็ก", price: 590 },
  { zone: "RESORT", name: "B4 เล็ก", price: 590 },
  { zone: "RESORT", name: "B5 เล็ก", price: 590 },
  { zone: "RESORT", name: "B6 เล็ก", price: 590 },
  { zone: "POOL_VILLA", name: "อิงน้ำ 1", price: 1200 },
  { zone: "POOL_VILLA", name: "อิงน้ำ 2", price: 1200 },
  { zone: "POOL_VILLA", name: "อิงน้ำ 3", price: 1200 },
  { zone: "POOL_VILLA", name: "กลางนา 1 (ล่าง)", price: 900 },
  { zone: "POOL_VILLA", name: "กลางนา 2 (ล่าง)", price: 900 },
  { zone: "POOL_VILLA", name: "กลางนา 3 (ล่าง)", price: 900 },
  { zone: "POOL_VILLA", name: "กลางนา 4 (ล่าง)", price: 900 },
  { zone: "POOL_VILLA", name: "กลางนา 5 (บน)", price: 700 },
  { zone: "POOL_VILLA", name: "กลางนา 6 (บน)", price: 700 },
  { zone: "POOL_VILLA", name: "กลางนา 7 (บน)", price: 700 },
  { zone: "POOL_VILLA", name: "กลางนา 8 (บน)", price: 700 },
  { zone: "POOL_VILLA", name: "เฮือนร่มไม้", price: 1000 },
];

/** Discounted rates for the sales/agent channel — one flat rate per room category, not per room. */
export const ACCOMMODATION_SALE_PRICES: { label: string; price: number | null }[] = [
  { label: "ห้องพักเล็ก", price: 550 },
  { label: "ห้องพักใหญ่", price: 750 },
  { label: "ห้องพักพูลวิลล่า", price: null },
];

export type BanquetPriceRow = {
  name: string;
  type: string;
  maxCapacity: number;
  hourlyPrice: number;
  dailyPrice: number;
  condition?: string;
  equipment: string;
};

export const BANQUET_PRICE_LIST: BanquetPriceRow[] = [
  {
    name: "VIP เล็ก 1",
    type: "VIP เล็ก",
    maxCapacity: 15,
    hourlyPrice: 200,
    dailyPrice: 1200,
    equipment: "TV 55 นิ้ว / ระบบเสียง / แอร์",
  },
  {
    name: "VIP เล็ก 2",
    type: "VIP เล็ก",
    maxCapacity: 15,
    hourlyPrice: 200,
    dailyPrice: 1200,
    equipment: "TV 55 นิ้ว / ระบบเสียง / แอร์",
  },
  {
    name: "VIP ใหญ่",
    type: "VIP ใหญ่",
    maxCapacity: 50,
    hourlyPrice: 400,
    dailyPrice: 3000,
    condition: "เช่าสถานที่ 1,500 บาท เมื่อสั่งอาหารกับบ้านโฮม",
    equipment: "จอโปรเจกเตอร์ / ระบบเสียง / แอร์",
  },
];

export type AdditionalChargeRow = {
  name: string;
  price: string;
  unit: string;
};

export const ADDITIONAL_CHARGE_LIST: AdditionalChargeRow[] = [
  { name: "สัตว์เลี้ยง", price: "200", unit: "ตัว" },
  { name: "เตียงเสริม", price: "200", unit: "เตียง" },
  { name: "ค่าบริการซักผ้า", price: "ระบุเอง", unit: "งาน" },
  { name: "หมอนเพิ่ม", price: "20", unit: "ใบ" },
  { name: "ค่าต่อชั่วโมงห้องพักรีสอร์ท", price: "100", unit: "บาท" },
  { name: "ค่าต่อชั่วโมงห้องพักพูลวิลล่า", price: "100", unit: "บาท" },
  { name: "ค่าปรับ", price: "ระบุเอง", unit: "บาท" },
  { name: "ผ้าห่มเพิ่ม", price: "50", unit: "บาท" },
];
