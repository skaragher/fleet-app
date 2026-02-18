/*
  Warnings:

  - A unique constraint covering the columns `[vehicleId,driverId]` on the table `VehicleAssignment` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "VehicleAssignment_vehicleId_driverId_key" ON "VehicleAssignment"("vehicleId", "driverId");
