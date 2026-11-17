-- CreateTable
CREATE TABLE "KpiMonthlyInput" (
    "month" TEXT NOT NULL,
    "banquetCost" DECIMAL(12,2),
    "restaurantGp" DECIMAL(5,2),
    "evaluationPct" DECIMAL(5,2),
    "updatedById" TEXT,
    "updatedByName" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KpiMonthlyInput_pkey" PRIMARY KEY ("month")
);
