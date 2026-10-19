-- AlterTable
ALTER TABLE "CleaningRecord" ADD COLUMN     "repairNote" TEXT;

-- CreateTable
CREATE TABLE "CleaningDayReview" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "userId" TEXT,
    "userName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CleaningDayReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CleaningDayReview_date_key" ON "CleaningDayReview"("date");

-- AddForeignKey
ALTER TABLE "CleaningDayReview" ADD CONSTRAINT "CleaningDayReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
