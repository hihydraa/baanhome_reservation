-- AlterTable
ALTER TABLE "AccommodationBooking" ADD COLUMN     "charterGroupId" TEXT;

-- CreateIndex
CREATE INDEX "AccommodationBooking_charterGroupId_idx" ON "AccommodationBooking"("charterGroupId");
