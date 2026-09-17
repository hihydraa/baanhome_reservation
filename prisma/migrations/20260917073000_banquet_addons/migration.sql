-- CreateEnum
CREATE TYPE "SpecialServiceScope" AS ENUM ('ACCOMMODATION', 'BANQUET');

-- AlterTable
ALTER TABLE "SpecialService" ADD COLUMN     "scope" "SpecialServiceScope" NOT NULL DEFAULT 'ACCOMMODATION';

-- CreateTable
CREATE TABLE "BanquetAddon" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "serviceId" TEXT,
    "description" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "price" DECIMAL(10,2) NOT NULL DEFAULT 0,

    CONSTRAINT "BanquetAddon_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "BanquetAddon" ADD CONSTRAINT "BanquetAddon_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "BanquetBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BanquetAddon" ADD CONSTRAINT "BanquetAddon_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "SpecialService"("id") ON DELETE SET NULL ON UPDATE CASCADE;
