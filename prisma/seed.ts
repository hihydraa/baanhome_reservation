import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { ACCOMMODATION_PRICE_LIST, BANQUET_PRICE_LIST } from "../lib/pricing";

const prisma = new PrismaClient();

type AccommodationSeed = { id: string; name: string; zone: "RESORT" | "POOL_VILLA" };

const RESORT_ROOM_SIZES = [
  "เล็ก",
  "เล็ก",
  "ใหญ่ (คู่)",
  "ใหญ่ (เดี่ยว)",
  "ใหญ่ (คู่)",
  "ใหญ่ (เดี่ยว)",
  "ใหญ่ (คู่)",
  "ใหญ่ (คู่)",
  "ใหญ่ (เดี่ยว)",
  "ใหญ่ (เดี่ยว)",
  "เล็ก",
  "เล็ก",
];

const KLANGNA_FLOORS = ["ล่าง", "ล่าง", "ล่าง", "ล่าง", "บน", "บน", "บน", "บน"];

const accommodationResources: AccommodationSeed[] = [
  ...RESORT_ROOM_SIZES.map((size, i) => ({
    id: `resort-room-${i + 1}`,
    name: `ห้อง ${i + 1} ${size}`,
    zone: "RESORT" as const,
  })),
  ...Array.from({ length: 6 }, (_, i) => ({
    id: `resort-b${i + 1}`,
    name: `B${i + 1} เล็ก`,
    zone: "RESORT" as const,
  })),
  ...Array.from({ length: 3 }, (_, i) => ({
    id: `poolvilla-rimnam-${i + 1}`,
    name: `อิงน้ำ ${i + 1}`,
    zone: "POOL_VILLA" as const,
  })),
  ...KLANGNA_FLOORS.map((floor, i) => ({
    id: `poolvilla-klangna-${i + 1}`,
    name: `กลางนา ${i + 1} (${floor})`,
    zone: "POOL_VILLA" as const,
  })),
  { id: "poolvilla-rommai", name: "เฮือนร่มไม้", zone: "POOL_VILLA" as const },
];

const banquetResources = [
  { id: "banquet-vip-lek-1", name: "VIP เล็ก 1", capacity: 15 },
  { id: "banquet-vip-lek-2", name: "VIP เล็ก 2", capacity: 15 },
  { id: "banquet-vip-yai", name: "VIP ใหญ่", capacity: 50 },
];

function accommodationPriceFor(name: string): number | undefined {
  return ACCOMMODATION_PRICE_LIST.find((r) => r.name === name)?.price;
}

function banquetPriceFor(name: string) {
  return BANQUET_PRICE_LIST.find((r) => r.name === name);
}

// Merged "ค่าบริการเพิ่มเติม" / "บริการพิเศษ" catalog — editable afterwards from the pricing page.
// Existing rows are never overwritten (see the upsert below), so an admin's edited price sticks.
const specialServices = [
  { name: "เตียงเสริม", price: 200 },
  { name: "สัตว์เลี้ยง", price: 300 },
  { name: "ค่าบริการซักผ้า", price: 0 },
  { name: "หมอนเพิ่ม", price: 20 },
  { name: "ค่าต่อชั่วโมงห้องพักรีสอร์ท", price: 100 },
  { name: "ค่าต่อชั่วโมงห้องพักพูลวิลล่า", price: 100 },
  { name: "ค่าปรับ", price: 0 },
  { name: "ผ้าห่มเพิ่ม", price: 50 },
];

// Banquet-scoped services — price is always blank (0) since it varies per booking/headcount;
// staff fill it in when they add it to a booking.
const banquetSpecialServices = [
  { name: "อาหารว่าง" },
  { name: "อาหารกลางวันคณะ" },
  { name: "อาหารบุฟเฟต์สำหรับคณะ" },
  { name: "เมนู Signature บ้านโฮม" },
];

async function main() {
  for (const [index, r] of accommodationResources.entries()) {
    const price = accommodationPriceFor(r.name);
    await prisma.resource.upsert({
      where: { id: r.id },
      update: { name: r.name, zone: r.zone, sortOrder: index },
      create: {
        id: r.id,
        name: r.name,
        zone: r.zone,
        type: "ACCOMMODATION",
        sortOrder: index,
        price,
      },
    });
    // Backfill the rate-sheet price only if it has never been set — never overwrite an admin's edit.
    if (price != null) {
      await prisma.resource.updateMany({ where: { id: r.id, price: null }, data: { price } });
    }
  }

  for (const [index, r] of banquetResources.entries()) {
    const priceInfo = banquetPriceFor(r.name);
    await prisma.resource.upsert({
      where: { id: r.id },
      update: { name: r.name, capacity: r.capacity, sortOrder: index },
      create: {
        id: r.id,
        name: r.name,
        zone: "BANQUET",
        type: "BANQUET",
        capacity: r.capacity,
        sortOrder: index,
        hourlyPrice: priceInfo?.hourlyPrice,
        dailyPrice: priceInfo?.dailyPrice,
        roomType: priceInfo?.type,
        priceCondition: priceInfo?.condition,
        equipment: priceInfo?.equipment,
      },
    });
    // Backfill the rate-sheet pricing only if it has never been set — never overwrite an admin's edit.
    if (priceInfo) {
      await prisma.resource.updateMany({
        where: { id: r.id, hourlyPrice: null },
        data: {
          hourlyPrice: priceInfo.hourlyPrice,
          dailyPrice: priceInfo.dailyPrice,
          roomType: priceInfo.type,
          priceCondition: priceInfo.condition,
          equipment: priceInfo.equipment,
        },
      });
    }
  }

  for (const s of specialServices) {
    await prisma.specialService.upsert({
      where: { name: s.name },
      update: {},
      create: { name: s.name, price: s.price, scope: "ACCOMMODATION" },
    });
  }

  for (const s of banquetSpecialServices) {
    await prisma.specialService.upsert({
      where: { name: s.name },
      update: {},
      create: { name: s.name, price: 0, scope: "BANQUET" },
    });
  }

  const existingAdmin = await prisma.user.findUnique({ where: { username: "admin" } });
  if (!existingAdmin) {
    const tempPassword = crypto.randomBytes(6).toString("base64url");
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    await prisma.user.create({
      data: {
        name: "ผู้ดูแลระบบ",
        username: "admin",
        passwordHash,
        role: "ADMIN",
      },
    });
    console.log("\n=================================");
    console.log(" สร้างบัญชีผู้ดูแลระบบเริ่มต้นแล้ว");
    console.log(` ชื่อผู้ใช้: admin`);
    console.log(` รหัสผ่านชั่วคราว: ${tempPassword}`);
    console.log(" กรุณาเข้าสู่ระบบแล้วสร้างบัญชีพนักงานคนอื่น ๆ ต่อจากหน้า 'จัดการผู้ใช้งาน'");
    console.log("=================================\n");
  } else {
    console.log("มีบัญชี admin อยู่แล้ว ข้ามการสร้างบัญชีใหม่");
  }

  console.log(
    `เตรียมทรัพยากรแล้ว: ${accommodationResources.length} ห้องพัก, ${banquetResources.length} ห้องจัดเลี้ยง`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
