-- CreateEnum
CREATE TYPE "CancellationAction" AS ENUM ('CANCEL', 'DELETE');

-- CreateEnum
CREATE TYPE "PaymentEntryAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE');

-- AlterTable
ALTER TABLE "AccommodationBooking" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedById" TEXT;

-- AlterTable
ALTER TABLE "BanquetBooking" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedById" TEXT;

-- AlterTable
ALTER TABLE "CancellationLog" ADD COLUMN     "action" "CancellationAction" NOT NULL DEFAULT 'CANCEL',
ADD COLUMN     "snapshot" JSONB;

-- CreateTable
CREATE TABLE "PaymentEntryLog" (
    "id" TEXT NOT NULL,
    "action" "PaymentEntryAction" NOT NULL,
    "entryId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "bookingType" "BookingType",
    "bookingId" TEXT,
    "bookingLabel" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "reason" TEXT,
    "userId" TEXT,
    "userName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentEntryLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentEntryLog_createdAt_idx" ON "PaymentEntryLog"("createdAt");

-- CreateIndex
CREATE INDEX "PaymentEntryLog_entryId_idx" ON "PaymentEntryLog"("entryId");

-- CreateIndex
CREATE INDEX "PaymentEntryLog_bookingId_idx" ON "PaymentEntryLog"("bookingId");

-- AddForeignKey
ALTER TABLE "PaymentEntryLog" ADD CONSTRAINT "PaymentEntryLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
