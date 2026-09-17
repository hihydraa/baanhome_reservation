-- Add the new payment method before it's referenced by PaymentEntry's default.
ALTER TYPE "PaymentMethod" ADD VALUE 'CREDIT_CARD';

-- CreateTable: the itemized payment ledger that replaces the old flat มัดจำ/จ่ายแล้ว fields.
CREATE TABLE "PaymentEntry" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "paidAt" TIMESTAMP(3) NOT NULL,
    "receivedById" TEXT,
    "notes" TEXT,
    "receiptNumber" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentEntry_receiptNumber_key" ON "PaymentEntry"("receiptNumber");

CREATE INDEX "PaymentEntry_paymentId_idx" ON "PaymentEntry"("paymentId");

ALTER TABLE "PaymentEntry" ADD CONSTRAINT "PaymentEntry_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PaymentEntry" ADD CONSTRAINT "PaymentEntry_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: turn every existing flat Payment row's มัดจำ/จ่ายแล้ว amounts into ledger entries,
-- so no historical payment is lost when those columns are dropped below.
WITH source AS (
  SELECT
    p.id AS "paymentId",
    'มัดจำ (ย้ายข้อมูลเดิม)' AS notes,
    p."depositAmount" AS amount,
    p."method" AS method,
    COALESCE(p."paidAt", p."createdAt") AS "paidAt"
  FROM "Payment" p
  WHERE p."depositAmount" > 0

  UNION ALL

  SELECT
    p.id AS "paymentId",
    'ชำระเพิ่มเติม (ย้ายข้อมูลเดิม)' AS notes,
    p."totalAmount" AS amount,
    p."method" AS method,
    COALESCE(p."paidAt", p."updatedAt") AS "paidAt"
  FROM "Payment" p
  WHERE p."totalAmount" > 0
),
numbered AS (
  SELECT
    *,
    ROW_NUMBER() OVER (PARTITION BY to_char("paidAt", 'YYMMDD') ORDER BY "paidAt", "paymentId") AS seq
  FROM source
)
INSERT INTO "PaymentEntry" (id, "paymentId", amount, method, "paidAt", notes, "receiptNumber", "createdAt")
SELECT
  gen_random_uuid()::text,
  "paymentId",
  amount,
  method,
  "paidAt",
  notes,
  'RC' || to_char("paidAt", 'YYMMDD') || '-' || lpad(seq::text, 3, '0'),
  "paidAt"
FROM numbered;

-- AlterTable: drop the old flat columns now that their data lives in PaymentEntry.
ALTER TABLE "Payment" DROP COLUMN "depositAmount",
DROP COLUMN "method",
DROP COLUMN "notes",
DROP COLUMN "paidAt",
DROP COLUMN "status",
DROP COLUMN "totalAmount";

-- DropEnum
DROP TYPE "PaymentStatus";
