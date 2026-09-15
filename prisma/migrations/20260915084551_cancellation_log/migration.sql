-- CreateEnum
CREATE TYPE "BookingType" AS ENUM ('ACCOMMODATION', 'BANQUET');

-- CreateTable
CREATE TABLE "CancellationLog" (
    "id" TEXT NOT NULL,
    "bookingType" "BookingType" NOT NULL,
    "bookingId" TEXT NOT NULL,
    "resourceName" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "phone" TEXT,
    "bookingPeriod" TEXT NOT NULL,
    "reason" TEXT,
    "cancelledById" TEXT,
    "cancelledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CancellationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CancellationLog_cancelledAt_idx" ON "CancellationLog"("cancelledAt");

-- AddForeignKey
ALTER TABLE "CancellationLog" ADD CONSTRAINT "CancellationLog_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
