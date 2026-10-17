-- CreateTable
CREATE TABLE "HousekeepingLog" (
    "id" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "roomName" TEXT NOT NULL,
    "fromStatus" "HousekeepingStatus" NOT NULL,
    "toStatus" "HousekeepingStatus" NOT NULL,
    "userId" TEXT,
    "userName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HousekeepingLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HousekeepingLog_createdAt_idx" ON "HousekeepingLog"("createdAt");

-- CreateIndex
CREATE INDEX "HousekeepingLog_resourceId_createdAt_idx" ON "HousekeepingLog"("resourceId", "createdAt");

-- AddForeignKey
ALTER TABLE "HousekeepingLog" ADD CONSTRAINT "HousekeepingLog_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HousekeepingLog" ADD CONSTRAINT "HousekeepingLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
