/**
 * One-off admin script: wipes all test bookings before going live.
 *
 * Deletes every AccommodationBooking and BanquetBooking (cascading to their
 * addons, Payment, PaymentEntry, and Attachment rows), every CancellationLog,
 * every Customer, and the corresponding files in the R2 attachments bucket.
 * Leaves Resource, SpecialService, and User rows untouched — those are
 * configuration, not booking data.
 *
 * Safety: defaults to a dry run that only prints counts. Pass --yes to
 * actually delete.
 *
 *   npx dotenv-cli -e .env.production.local -- npx tsx prisma/reset-test-data.ts
 *   npx dotenv-cli -e .env.production.local -- npx tsx prisma/reset-test-data.ts --yes
 */
import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";
import ws from "ws";
import { deleteObject } from "../lib/r2";

neonConfig.webSocketConstructor = ws;

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const commit = process.argv.includes("--yes");

async function main() {
  const [accommodationCount, banquetCount, cancellationCount, customerCount, attachments] = await Promise.all([
    prisma.accommodationBooking.count(),
    prisma.banquetBooking.count(),
    prisma.cancellationLog.count(),
    prisma.customer.count(),
    prisma.attachment.findMany({ select: { key: true } }),
  ]);

  console.log("จะลบข้อมูลต่อไปนี้:");
  console.log(`  การจองห้องพัก (AccommodationBooking): ${accommodationCount} รายการ`);
  console.log(`  การจองห้องจัดเลี้ยง (BanquetBooking): ${banquetCount} รายการ`);
  console.log(`  ประวัติการยกเลิก (CancellationLog): ${cancellationCount} รายการ`);
  console.log(`  ฐานข้อมูลลูกค้า (Customer): ${customerCount} รายการ`);
  console.log(`  ไฟล์แนบใน R2: ${attachments.length} ไฟล์`);
  console.log("(จะไม่แตะ Resource, SpecialService, User — ข้อมูลตั้งค่าระบบ)");
  console.log();

  if (!commit) {
    console.log("นี่คือ dry run (แสดงตัวอย่างเท่านั้น ยังไม่ลบจริง)");
    console.log("รันซ้ำพร้อม --yes เพื่อลบจริง");
    return;
  }

  console.log("กำลังลบจริง...");

  // Cascades to addons, Payment, PaymentEntry, Attachment rows.
  const deletedAccommodation = await prisma.accommodationBooking.deleteMany({});
  const deletedBanquet = await prisma.banquetBooking.deleteMany({});
  const deletedCancellations = await prisma.cancellationLog.deleteMany({});
  const deletedCustomers = await prisma.customer.deleteMany({});

  console.log(`ลบการจองห้องพักแล้ว: ${deletedAccommodation.count} รายการ`);
  console.log(`ลบการจองห้องจัดเลี้ยงแล้ว: ${deletedBanquet.count} รายการ`);
  console.log(`ลบประวัติการยกเลิกแล้ว: ${deletedCancellations.count} รายการ`);
  console.log(`ลบฐานข้อมูลลูกค้าแล้ว: ${deletedCustomers.count} รายการ`);

  let r2Deleted = 0;
  let r2Failed = 0;
  for (const a of attachments) {
    try {
      await deleteObject(a.key);
      r2Deleted++;
    } catch (e) {
      r2Failed++;
      console.error(`ลบไฟล์ R2 ไม่สำเร็จ: ${a.key}`, e instanceof Error ? e.message : e);
    }
  }
  console.log(`ลบไฟล์ใน R2 แล้ว: ${r2Deleted}/${attachments.length} ไฟล์${r2Failed > 0 ? ` (ลบไม่สำเร็จ ${r2Failed} ไฟล์ — ดู error ด้านบน)` : ""}`);

  console.log();
  console.log("เสร็จสิ้น — ระบบพร้อมใช้งานจริงแล้ว");
}

main()
  .catch((e) => {
    console.error("เกิดข้อผิดพลาด:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
