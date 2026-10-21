-- CreateEnum
CREATE TYPE "AuditFindingStatus" AS ENUM ('OPEN', 'CLEARED', 'CONFIRMED');

-- CreateTable
CREATE TABLE "AuditFinding" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "night" TIMESTAMP(3) NOT NULL,
    "resourceId" TEXT NOT NULL,
    "roomName" TEXT NOT NULL,
    "bookingId" TEXT,
    "customerName" TEXT,
    "detail" TEXT,
    "amount" DECIMAL(10,2),
    "responsible" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vanishedAt" TIMESTAMP(3),
    "status" "AuditFindingStatus" NOT NULL DEFAULT 'OPEN',
    "note" TEXT,
    "reviewedById" TEXT,
    "reviewedByName" TEXT,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "AuditFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingStatusLog" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "fromStatus" "AccommodationStatus",
    "toStatus" "AccommodationStatus" NOT NULL,
    "userId" TEXT,
    "userName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingStatusLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuditFinding_key_key" ON "AuditFinding"("key");

-- CreateIndex
CREATE INDEX "AuditFinding_status_severity_idx" ON "AuditFinding"("status", "severity");

-- CreateIndex
CREATE INDEX "AuditFinding_night_idx" ON "AuditFinding"("night");

-- CreateIndex
CREATE INDEX "BookingStatusLog_bookingId_createdAt_idx" ON "BookingStatusLog"("bookingId", "createdAt");
