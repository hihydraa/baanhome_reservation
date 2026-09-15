-- AlterTable
ALTER TABLE "AccommodationAddon" DROP COLUMN "type",
ADD COLUMN     "serviceId" TEXT;

-- DropEnum
DROP TYPE "AddonType";

-- CreateTable
CREATE TABLE "SpecialService" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpecialService_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SpecialService_name_key" ON "SpecialService"("name");

-- AddForeignKey
ALTER TABLE "AccommodationAddon" ADD CONSTRAINT "AccommodationAddon_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "SpecialService"("id") ON DELETE SET NULL ON UPDATE CASCADE;
