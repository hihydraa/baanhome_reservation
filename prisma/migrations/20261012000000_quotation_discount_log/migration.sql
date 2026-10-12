-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('BAHT', 'PERCENT');

-- AlterTable
ALTER TABLE "BanquetBooking" ADD COLUMN     "discountType" "DiscountType" NOT NULL DEFAULT 'BAHT',
ADD COLUMN     "discountValue" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "QuotationLog" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "userId" TEXT,
    "userName" TEXT NOT NULL,
    "changes" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuotationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuotationLog_bookingId_createdAt_idx" ON "QuotationLog"("bookingId", "createdAt");

-- AddForeignKey
ALTER TABLE "QuotationLog" ADD CONSTRAINT "QuotationLog_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "BanquetBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationLog" ADD CONSTRAINT "QuotationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
