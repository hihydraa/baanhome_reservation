# บ้านโฮม Mini MICE — ระบบจองห้องพักและห้องจัดเลี้ยง

ระบบภายในสำหรับทดแทนการจดบันทึกจองห้องพักและห้องจัดเลี้ยงลงกระดาษรายวัน สร้างด้วย Next.js
พร้อม deploy บน Vercel

## Tech Stack

- **Next.js 16** (App Router, TypeScript)
- **Tailwind CSS v4** — ธีมสีตามแบรนด์ (เขียวเข้ม/ทอง/ครีม) กำหนดไว้ที่ [app/globals.css](app/globals.css)
- **Prisma ORM + PostgreSQL** — ออกแบบมาให้ใช้กับ Vercel Postgres (Neon)
- **Auth.js (NextAuth v5)** — ระบบ login รายบุคคล (username/password, bcrypt)
- **zod** — validate ข้อมูลทุก API route
- **date-fns** และ helper ใน [lib/dates.ts](lib/dates.ts) — จัดการวันที่/เวลาแบบ Asia/Bangkok โดยไม่พึ่ง timezone ของเครื่อง server

## โครงสร้างข้อมูล (Database Schema)

ดูรายละเอียดทั้งหมดที่ [prisma/schema.prisma](prisma/schema.prisma) สรุปสั้น ๆ:

- `User` — บัญชีพนักงาน (ADMIN / STAFF)
- `Resource` — ทรัพยากรที่จองได้ทั้งหมด แยกด้วย `type` (`ACCOMMODATION` / `BANQUET`) และ `zone`
- `AccommodationBooking` + `AccommodationAddon` — การจองห้องพักรายคืน พร้อมบริการเสริม (เตียงเสริม/สัตว์เลี้ยง/ของยืม)
- `BanquetBooking` — การจองห้องจัดเลี้ยงรายชั่วโมง เชื่อมโยงกับห้องพักได้ (`linkedAccommodationId`)
- `Payment` — ผูกกับการจอง 1 รายการเสมอ (accommodation หรือ banquet อย่างใดอย่างหนึ่ง) เก็บยอดรวม/มัดจำ/สถานะ/วิธีชำระ

**การตรวจสอบคิวชนกัน (Conflict Detection)** อยู่ที่ [lib/booking-conflicts.ts](lib/booking-conflicts.ts)
ใช้ร่วมกันทั้งตอนสร้าง/แก้ไขการจอง และ endpoint `/api/banquet-bookings/check-conflict` ที่หน้าฟอร์มเรียกแบบ real-time

## เริ่มพัฒนาในเครื่อง (Local Development)

### 1. ติดตั้ง dependencies

```bash
npm install
```

### 2. เตรียมฐานข้อมูล

ก็อปปี้ `.env.example` เป็น `.env` แล้วใส่ค่า:

```bash
cp .env.example .env
```

สำหรับพัฒนาในเครื่องโดยไม่ต้องมี Postgres ของตัวเอง สามารถใช้ Prisma's local dev database ได้ทันที (ไม่ต้องติดตั้ง Docker):

```bash
npx prisma dev
```

คำสั่งนี้จะพิมพ์ connection string ออกมา ให้นำไปใส่ใน `DATABASE_URL` และ `DIRECT_URL` ใน `.env`

### 3. Migrate + Seed

```bash
npm run db:migrate
npm run db:seed
```

`db:seed` จะสร้างห้องพักและห้องจัดเลี้ยงทั้งหมดตาม requirement พร้อมบัญชี `admin` — **จดรหัสผ่านชั่วคราวที่พิมพ์ออกมาในเทอร์มินัลไว้** แล้วไปสร้างบัญชีพนักงานคนอื่นต่อในหน้า "จัดการผู้ใช้งาน" หลัง login

### 4. รันเซิร์ฟเวอร์

```bash
npm run dev
```

เปิด [http://localhost:3000](http://localhost:3000)

## Deploy บน Vercel

1. Push โค้ดขึ้น Git repository แล้วสร้างโปรเจกต์ใหม่ใน Vercel จาก repo นี้
2. ไปที่แท็บ **Storage** ของโปรเจกต์ → เพิ่ม **Vercel Postgres (Neon)** — Vercel จะตั้งค่า env vars ที่เกี่ยวข้องให้อัตโนมัติ
3. ตั้งค่า Environment Variables เพิ่มเติมในโปรเจกต์ Vercel:
   - `DATABASE_URL` — ใช้ pooled connection string จาก Neon (ควรมี `?pgbouncer=true` ต่อท้ายเพื่อให้ใช้งานร่วมกับ Prisma ได้ถูกต้องเมื่อรันผ่าน connection pooler)
   - `DIRECT_URL` — ใช้ direct (non-pooled) connection string จาก Neon สำหรับรัน migration
   - `AUTH_SECRET` — สร้างด้วย `npx auth secret` หรือ `openssl rand -base64 32`
   - `NEXTAUTH_URL` — URL จริงของเว็บหลัง deploy (เช่น `https://your-app.vercel.app`)
4. รัน migration กับฐานข้อมูล production ครั้งแรก (รันจากเครื่อง โดยตั้ง `DATABASE_URL`/`DIRECT_URL` ชี้ไปที่ Neon):
   ```bash
   npm run db:deploy
   npm run db:seed
   ```
5. Deploy โปรเจกต์ใน Vercel ตามปกติ (`git push` หรือกด Deploy)
6. Login ด้วยบัญชี `admin` และรหัสผ่านชั่วคราวจาก log ตอน seed แล้วสร้างบัญชีพนักงานจริงทันทีในหน้า "จัดการผู้ใช้งาน"

## โครงสร้างหน้าเว็บหลัก

- `/dashboard` — ภาพรวมรายวัน (Module 1) ดูสถานะห้องพักทุกห้อง + แถบห้องจัดเลี้ยงของวันนั้น
- `/accommodation`, `/accommodation/[id]` — รายการ/จอง/แก้ไขห้องพัก (Module 2)
- `/banquet`, `/banquet/new`, `/banquet/[id]` — จองห้องจัดเลี้ยงแบบรายชั่วโมง + ปฏิทิน 31 วัน พร้อมเช็คคิวชนแบบ real-time (Module 3)
- `/users` — จัดการบัญชีพนักงาน (เฉพาะ ADMIN)

การชำระเงิน (Module 4) ฝังอยู่ในฟอร์มจองห้องพัก/ห้องจัดเลี้ยงโดยตรง (`components/payment/PaymentPanel.tsx`) — เลือกสถานะได้ทั้งจ่ายแล้ว/มัดจำ/จ่ายทีหลัง ไม่บังคับมัดจำ
