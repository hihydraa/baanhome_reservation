-- AlterTable
ALTER TABLE "AccommodationBooking" ADD COLUMN     "discountNote" TEXT,
ADD COLUMN     "discountType" "DiscountType" NOT NULL DEFAULT 'BAHT',
ADD COLUMN     "discountValue" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "QuotationLog" ADD COLUMN     "accommodationBookingId" TEXT,
ALTER COLUMN "bookingId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "QuotationLog_accommodationBookingId_createdAt_idx" ON "QuotationLog"("accommodationBookingId", "createdAt");

-- AddForeignKey
ALTER TABLE "QuotationLog" ADD CONSTRAINT "QuotationLog_accommodationBookingId_fkey" FOREIGN KEY ("accommodationBookingId") REFERENCES "AccommodationBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
