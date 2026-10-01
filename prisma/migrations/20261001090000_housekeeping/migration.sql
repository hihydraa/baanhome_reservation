-- CreateEnum
CREATE TYPE "HousekeepingStatus" AS ENUM ('READY', 'NEEDS_CLEANING', 'OUT_OF_SERVICE');

-- AlterTable
ALTER TABLE "Resource" ADD COLUMN     "housekeepingStatus" "HousekeepingStatus" NOT NULL DEFAULT 'READY';

-- AlterTable
ALTER TABLE "AccommodationBooking" ADD COLUMN     "needsAdditionalService" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "extensionCount" INTEGER NOT NULL DEFAULT 0;
