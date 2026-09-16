-- AlterTable
ALTER TABLE "Resource" ADD COLUMN     "dailyPrice" DECIMAL(10,2),
ADD COLUMN     "equipment" TEXT,
ADD COLUMN     "hourlyPrice" DECIMAL(10,2),
ADD COLUMN     "price" DECIMAL(10,2),
ADD COLUMN     "priceCondition" TEXT,
ADD COLUMN     "roomType" TEXT;
