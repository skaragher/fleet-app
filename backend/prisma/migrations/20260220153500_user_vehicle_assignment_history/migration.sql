-- CreateTable
CREATE TABLE "UserVehicleAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unassignedAt" TIMESTAMP(3),
    "assignedById" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserVehicleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserVehicleAssignment_userId_idx" ON "UserVehicleAssignment"("userId");

-- CreateIndex
CREATE INDEX "UserVehicleAssignment_vehicleId_idx" ON "UserVehicleAssignment"("vehicleId");

-- CreateIndex
CREATE INDEX "UserVehicleAssignment_assignedAt_idx" ON "UserVehicleAssignment"("assignedAt");

-- CreateIndex
CREATE INDEX "UserVehicleAssignment_unassignedAt_idx" ON "UserVehicleAssignment"("unassignedAt");

-- One active assignment per user
CREATE UNIQUE INDEX "UserVehicleAssignment_active_user_unique"
ON "UserVehicleAssignment"("userId")
WHERE "unassignedAt" IS NULL;

-- One active assignment per vehicle
CREATE UNIQUE INDEX "UserVehicleAssignment_active_vehicle_unique"
ON "UserVehicleAssignment"("vehicleId")
WHERE "unassignedAt" IS NULL;

-- AddForeignKey
ALTER TABLE "UserVehicleAssignment" ADD CONSTRAINT "UserVehicleAssignment_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserVehicleAssignment" ADD CONSTRAINT "UserVehicleAssignment_vehicleId_fkey"
FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserVehicleAssignment" ADD CONSTRAINT "UserVehicleAssignment_assignedById_fkey"
FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
