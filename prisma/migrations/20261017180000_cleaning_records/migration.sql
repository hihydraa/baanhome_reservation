-- CreateEnum
CREATE TYPE "CleaningType" AS ENUM ('CHECKOUT', 'STAY');

-- CreateTable
CREATE TABLE "CleaningRecord" (
    "id" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "roomName" TEXT NOT NULL,
    "type" "CleaningType" NOT NULL,
    "serviceDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "userId" TEXT,
    "userName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CleaningRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CleaningRecordItem" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "CleaningRecordItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CleaningRecord_serviceDate_idx" ON "CleaningRecord"("serviceDate");

-- CreateIndex
CREATE INDEX "CleaningRecord_resourceId_serviceDate_idx" ON "CleaningRecord"("resourceId", "serviceDate");

-- CreateIndex
CREATE INDEX "CleaningRecordItem_recordId_idx" ON "CleaningRecordItem"("recordId");

-- AddForeignKey
ALTER TABLE "CleaningRecord" ADD CONSTRAINT "CleaningRecord_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CleaningRecord" ADD CONSTRAINT "CleaningRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CleaningRecordItem" ADD CONSTRAINT "CleaningRecordItem_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "CleaningRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
