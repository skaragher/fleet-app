/*
  Warnings:

  - The values [ADMIN,GESTIONNAIRE,OPERATEUR] on the enum `UserRole` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "UserRole_new" AS ENUM ('SUPER_ADMIN', 'FLEET_MANAGER', 'STATION_MANAGER', 'VEHICLE_MANAGER', 'DRIVER', 'VIEWER');
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole_new" USING ("role"::text::"UserRole_new");
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
DROP TYPE "UserRole_old";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'VIEWER';
COMMIT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "assignedStationId" TEXT,
ADD COLUMN     "assignedVehicleId" TEXT,
ADD COLUMN     "permissions" TEXT[];

-- CreateIndex
CREATE INDEX "User_assignedStationId_idx" ON "User"("assignedStationId");

-- CreateIndex
CREATE INDEX "User_assignedVehicleId_idx" ON "User"("assignedVehicleId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_assignedStationId_fkey" FOREIGN KEY ("assignedStationId") REFERENCES "Station"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_assignedVehicleId_fkey" FOREIGN KEY ("assignedVehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
