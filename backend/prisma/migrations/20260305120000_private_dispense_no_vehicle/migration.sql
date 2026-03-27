-- Allow private fuel dispenses without creating a company vehicle row
ALTER TABLE "FuelDispense"
ALTER COLUMN "vehicleId" DROP NOT NULL;

ALTER TABLE "FuelDispense"
ADD COLUMN "privatePlate" TEXT,
ADD COLUMN "privateMake" TEXT,
ADD COLUMN "privateModel" TEXT,
ADD COLUMN "privateFuelType" "FuelType";
