-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'STAFF');

-- CreateEnum
CREATE TYPE "ResourceZone" AS ENUM ('RESORT', 'POOL_VILLA', 'RIMNAM', 'KLANGNA', 'ROMMAI', 'BANQUET');

-- CreateEnum
CREATE TYPE "ResourceType" AS ENUM ('ACCOMMODATION', 'BANQUET');

-- CreateEnum
CREATE TYPE "BookingSource" AS ENUM ('WALK_IN', 'AGODA', 'PHONE', 'OTHER');

-- CreateEnum
CREATE TYPE "AccommodationStatus" AS ENUM ('RESERVED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AddonType" AS ENUM ('EXTRA_BED', 'PET', 'BORROWED_ITEM');

-- CreateEnum
CREATE TYPE "BanquetEventType" AS ENUM ('MEETING', 'BANQUET', 'SEMINAR', 'OTHER');

-- CreateEnum
CREATE TYPE "BanquetStatus" AS ENUM ('RESERVED', 'CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PAID', 'DEPOSIT', 'PAY_LATER');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'TRANSFER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'STAFF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Resource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "zone" "ResourceZone" NOT NULL,
    "type" "ResourceType" NOT NULL,
    "capacity" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccommodationBooking" (
    "id" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "source" "BookingSource" NOT NULL DEFAULT 'WALK_IN',
    "checkIn" TIMESTAMP(3) NOT NULL,
    "checkOut" TIMESTAMP(3) NOT NULL,
    "guestCount" INTEGER NOT NULL DEFAULT 1,
    "status" "AccommodationStatus" NOT NULL DEFAULT 'RESERVED',
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccommodationBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccommodationAddon" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "type" "AddonType" NOT NULL,
    "description" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "price" DECIMAL(10,2) NOT NULL DEFAULT 0,

    CONSTRAINT "AccommodationAddon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BanquetBooking" (
    "id" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "phone" TEXT,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "eventType" "BanquetEventType" NOT NULL DEFAULT 'MEETING',
    "headcount" INTEGER NOT NULL DEFAULT 1,
    "foodService" TEXT,
    "linkedAccommodationId" TEXT,
    "status" "BanquetStatus" NOT NULL DEFAULT 'RESERVED',
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BanquetBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "accommodationBookingId" TEXT,
    "banquetBookingId" TEXT,
    "totalAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "depositAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PAY_LATER',
    "method" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "paidAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "Resource_type_zone_sortOrder_idx" ON "Resource"("type", "zone", "sortOrder");

-- CreateIndex
CREATE INDEX "AccommodationBooking_resourceId_checkIn_checkOut_idx" ON "AccommodationBooking"("resourceId", "checkIn", "checkOut");

-- CreateIndex
CREATE INDEX "BanquetBooking_resourceId_eventDate_idx" ON "BanquetBooking"("resourceId", "eventDate");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_accommodationBookingId_key" ON "Payment"("accommodationBookingId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_banquetBookingId_key" ON "Payment"("banquetBookingId");

-- AddForeignKey
ALTER TABLE "AccommodationBooking" ADD CONSTRAINT "AccommodationBooking_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccommodationBooking" ADD CONSTRAINT "AccommodationBooking_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccommodationAddon" ADD CONSTRAINT "AccommodationAddon_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "AccommodationBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BanquetBooking" ADD CONSTRAINT "BanquetBooking_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BanquetBooking" ADD CONSTRAINT "BanquetBooking_linkedAccommodationId_fkey" FOREIGN KEY ("linkedAccommodationId") REFERENCES "AccommodationBooking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BanquetBooking" ADD CONSTRAINT "BanquetBooking_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_accommodationBookingId_fkey" FOREIGN KEY ("accommodationBookingId") REFERENCES "AccommodationBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_banquetBookingId_fkey" FOREIGN KEY ("banquetBookingId") REFERENCES "BanquetBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
