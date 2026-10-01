-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "accommodationBookingId" TEXT,
    "banquetBookingId" TEXT,
    "key" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Attachment_accommodationBookingId_idx" ON "Attachment"("accommodationBookingId");

-- CreateIndex
CREATE INDEX "Attachment_banquetBookingId_idx" ON "Attachment"("banquetBookingId");

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_accommodationBookingId_fkey" FOREIGN KEY ("accommodationBookingId") REFERENCES "AccommodationBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_banquetBookingId_fkey" FOREIGN KEY ("banquetBookingId") REFERENCES "BanquetBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
