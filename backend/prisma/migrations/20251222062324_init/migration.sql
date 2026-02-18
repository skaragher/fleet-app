/*
  Warnings:

  - The values [GASOLINE] on the enum `FuelType` will be removed. If these variants are still used in the database, this will fail.
  - The values [FLEET_MANAGER,FUEL_OPERATOR] on the enum `UserRole` will be removed. If these variants are still used in the database, this will fail.
  - The values [IN_SERVICE,IN_REPAIR,OUT_OF_SERVICE] on the enum `VehicleStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `insurer` on the `InsurancePolicy` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `Maintenance` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[chassisNumber]` on the table `Vehicle` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `typeLicence` to the `Driver` table without a default value. This is not possible if the table is not empty.
  - Made the column `licenseNo` on table `Driver` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `insurancesType` to the `InsurancePolicy` table without a default value. This is not possible if the table is not empty.
  - Added the required column `maintenanceType` to the `Maintenance` table without a default value. This is not possible if the table is not empty.
  - Added the required column `chassisNumber` to the `Vehicle` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "InsurancesType" AS ENUM ('TIERS', 'INTERMEDIAIRE', 'TOUS_RISQUES');

-- CreateEnum
CREATE TYPE "MaintenanceType" AS ENUM ('REVISION', 'VIDANGE', 'REPARATION', 'DEPANNAGE');

-- AlterEnum
BEGIN;
CREATE TYPE "FuelType_new" AS ENUM ('DIESEL', 'SUPER', 'LUBRIFIANT', 'HUILE');
ALTER TABLE "Vehicle" ALTER COLUMN "fuelType" TYPE "FuelType_new" USING ("fuelType"::text::"FuelType_new");
ALTER TABLE "Tank" ALTER COLUMN "fuelType" TYPE "FuelType_new" USING ("fuelType"::text::"FuelType_new");
ALTER TYPE "FuelType" RENAME TO "FuelType_old";
ALTER TYPE "FuelType_new" RENAME TO "FuelType";
DROP TYPE "FuelType_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "UserRole_new" AS ENUM ('ADMIN', 'GESTIONNAIRE', 'OPERATEUR', 'VIEWER');
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole_new" USING ("role"::text::"UserRole_new");
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
DROP TYPE "UserRole_old";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'VIEWER';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "VehicleStatus_new" AS ENUM ('EN_SERVICE', 'EN_REPARATION', 'HORS_SERVICE');
ALTER TABLE "Vehicle" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Vehicle" ALTER COLUMN "status" TYPE "VehicleStatus_new" USING ("status"::text::"VehicleStatus_new");
ALTER TYPE "VehicleStatus" RENAME TO "VehicleStatus_old";
ALTER TYPE "VehicleStatus_new" RENAME TO "VehicleStatus";
DROP TYPE "VehicleStatus_old";
ALTER TABLE "Vehicle" ALTER COLUMN "status" SET DEFAULT 'EN_SERVICE';
COMMIT;

-- DropForeignKey
ALTER TABLE "InsurancePolicy" DROP CONSTRAINT "InsurancePolicy_vehicleId_fkey";

-- DropForeignKey
ALTER TABLE "Maintenance" DROP CONSTRAINT "Maintenance_vehicleId_fkey";

-- DropIndex
DROP INDEX "FuelDispense_stationId_idx";

-- DropIndex
DROP INDEX "FuelDispense_tankId_idx";

-- DropIndex
DROP INDEX "FuelDispense_vehicleId_idx";

-- DropIndex
DROP INDEX "FuelSupply_stationId_idx";

-- DropIndex
DROP INDEX "FuelSupply_tankId_idx";

-- DropIndex
DROP INDEX "Inspection_vehicleId_idx";

-- DropIndex
DROP INDEX "InsurancePolicy_vehicleId_idx";

-- DropIndex
DROP INDEX "Maintenance_vehicleId_idx";

-- DropIndex
DROP INDEX "Tank_stationId_idx";

-- AlterTable
ALTER TABLE "Driver" ADD COLUMN     "birthDate" TIMESTAMP(3),
ADD COLUMN     "endDateLicence" TIMESTAMP(3),
ADD COLUMN     "typeLicence" TEXT NOT NULL,
ALTER COLUMN "licenseNo" SET NOT NULL;

-- AlterTable
ALTER TABLE "InsurancePolicy" DROP COLUMN "insurer",
ADD COLUMN     "insurancesType" "InsurancesType" NOT NULL,
ADD COLUMN     "insurerId" TEXT,
ALTER COLUMN "vehicleId" DROP NOT NULL,
ALTER COLUMN "policyNo" DROP NOT NULL,
ALTER COLUMN "startAt" DROP NOT NULL,
ALTER COLUMN "endAt" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Maintenance" DROP COLUMN "type",
ADD COLUMN     "maintenanceType" "MaintenanceType" NOT NULL,
ALTER COLUMN "vehicleId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Station" ADD COLUMN     "address" TEXT,
ADD COLUMN     "openingDate" TIMESTAMP(3),
ADD COLUMN     "phone" TEXT;

-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN     "chassisNumber" TEXT NOT NULL,
ADD COLUMN     "commissioningDate" TIMESTAMP(3),
ALTER COLUMN "status" SET DEFAULT 'EN_SERVICE';

-- AlterTable
ALTER TABLE "VehicleAssignment" ADD COLUMN     "userId" TEXT;

-- CreateTable
CREATE TABLE "Insurer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "address" TEXT,
    "phone1" TEXT,
    "phone2" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Insurer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_chassisNumber_key" ON "Vehicle"("chassisNumber");

-- CreateIndex
CREATE INDEX "VehicleAssignment_userId_idx" ON "VehicleAssignment"("userId");

-- AddForeignKey
ALTER TABLE "VehicleAssignment" ADD CONSTRAINT "VehicleAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Maintenance" ADD CONSTRAINT "Maintenance_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsurancePolicy" ADD CONSTRAINT "InsurancePolicy_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsurancePolicy" ADD CONSTRAINT "InsurancePolicy_insurerId_fkey" FOREIGN KEY ("insurerId") REFERENCES "Insurer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
