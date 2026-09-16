-- DropForeignKey
ALTER TABLE "BanquetBooking" DROP CONSTRAINT "BanquetBooking_linkedAccommodationId_fkey";

-- AlterTable
ALTER TABLE "BanquetBooking" DROP COLUMN "linkedAccommodationId";

-- CreateTable
CREATE TABLE "_LinkedAccommodation" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_LinkedAccommodation_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_LinkedAccommodation_B_index" ON "_LinkedAccommodation"("B");

-- AddForeignKey
ALTER TABLE "_LinkedAccommodation" ADD CONSTRAINT "_LinkedAccommodation_A_fkey" FOREIGN KEY ("A") REFERENCES "AccommodationBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_LinkedAccommodation" ADD CONSTRAINT "_LinkedAccommodation_B_fkey" FOREIGN KEY ("B") REFERENCES "BanquetBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
