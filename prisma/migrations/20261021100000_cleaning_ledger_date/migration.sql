-- AlterTable: the date the paper log shows. Existing rows default to the day before they were recorded.
ALTER TABLE "CleaningRecord" ADD COLUMN "ledgerDate" TIMESTAMP(3);
UPDATE "CleaningRecord" SET "ledgerDate" = "serviceDate" - INTERVAL '1 day';
ALTER TABLE "CleaningRecord" ALTER COLUMN "ledgerDate" SET NOT NULL;

-- CreateIndex
CREATE INDEX "CleaningRecord_ledgerDate_idx" ON "CleaningRecord"("ledgerDate");
