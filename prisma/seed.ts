import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";

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

async function main() {
  for (const [index, r] of accommodationResources.entries()) {
    await prisma.resource.upsert({
      where: { id: r.id },
      update: { name: r.name, zone: r.zone, sortOrder: index },
      create: {
        id: r.id,
        name: r.name,
        zone: r.zone,
        type: "ACCOMMODATION",
        sortOrder: index,
      },
    });
  }

  for (const [index, r] of banquetResources.entries()) {
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
      },
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
