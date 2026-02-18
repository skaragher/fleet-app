-- CreateIndex
CREATE INDEX "FuelDispense_stationId_idx" ON "FuelDispense"("stationId");

-- CreateIndex
CREATE INDEX "FuelDispense_tankId_idx" ON "FuelDispense"("tankId");

-- CreateIndex
CREATE INDEX "FuelDispense_vehicleId_idx" ON "FuelDispense"("vehicleId");

-- CreateIndex
CREATE INDEX "FuelSupply_stationId_idx" ON "FuelSupply"("stationId");

-- CreateIndex
CREATE INDEX "FuelSupply_tankId_idx" ON "FuelSupply"("tankId");
