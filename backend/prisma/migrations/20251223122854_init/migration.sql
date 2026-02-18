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
DROP INDEX "VehicleAssignment_vehicleId_driverId_key";

-- AlterTable
ALTER TABLE "Maintenance" ALTER COLUMN "status" DROP DEFAULT;
