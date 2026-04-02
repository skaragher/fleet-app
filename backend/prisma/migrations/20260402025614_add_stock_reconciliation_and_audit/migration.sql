-- CreateEnum
CREATE TYPE "ReconciliationStatus" AS ENUM ('PENDING', 'VALIDATED', 'REJECTED');

-- CreateEnum
CREATE TYPE "StockAction" AS ENUM ('SUPPLY', 'DISPENSE', 'RECONCILIATION', 'ADJUSTMENT');

-- CreateTable
CREATE TABLE "StockReconciliation" (
    "id" TEXT NOT NULL,
    "tankId" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "systemL" INTEGER NOT NULL,
    "physicalL" INTEGER NOT NULL,
    "adjustmentL" INTEGER NOT NULL,
    "reason" TEXT,
    "notes" TEXT,
    "status" "ReconciliationStatus" NOT NULL DEFAULT 'PENDING',
    "performedBy" TEXT NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validatedBy" TEXT,
    "validatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockReconciliation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockAuditLog" (
    "id" TEXT NOT NULL,
    "tankId" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "action" "StockAction" NOT NULL,
    "userId" TEXT,
    "userName" TEXT,
    "previousL" INTEGER NOT NULL,
    "newL" INTEGER NOT NULL,
    "deltaL" INTEGER NOT NULL,
    "relatedId" TEXT,
    "relatedType" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockReconciliation_tankId_idx" ON "StockReconciliation"("tankId");

-- CreateIndex
CREATE INDEX "StockReconciliation_stationId_idx" ON "StockReconciliation"("stationId");

-- CreateIndex
CREATE INDEX "StockReconciliation_performedBy_idx" ON "StockReconciliation"("performedBy");

-- CreateIndex
CREATE INDEX "StockReconciliation_performedAt_idx" ON "StockReconciliation"("performedAt");

-- CreateIndex
CREATE INDEX "StockReconciliation_status_idx" ON "StockReconciliation"("status");

-- CreateIndex
CREATE INDEX "StockAuditLog_tankId_idx" ON "StockAuditLog"("tankId");

-- CreateIndex
CREATE INDEX "StockAuditLog_stationId_idx" ON "StockAuditLog"("stationId");

-- CreateIndex
CREATE INDEX "StockAuditLog_userId_idx" ON "StockAuditLog"("userId");

-- CreateIndex
CREATE INDEX "StockAuditLog_createdAt_idx" ON "StockAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "StockAuditLog_action_idx" ON "StockAuditLog"("action");

-- AddForeignKey
ALTER TABLE "StockReconciliation" ADD CONSTRAINT "StockReconciliation_tankId_fkey" FOREIGN KEY ("tankId") REFERENCES "Tank"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReconciliation" ADD CONSTRAINT "StockReconciliation_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReconciliation" ADD CONSTRAINT "StockReconciliation_performedBy_fkey" FOREIGN KEY ("performedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReconciliation" ADD CONSTRAINT "StockReconciliation_validatedBy_fkey" FOREIGN KEY ("validatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAuditLog" ADD CONSTRAINT "StockAuditLog_tankId_fkey" FOREIGN KEY ("tankId") REFERENCES "Tank"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAuditLog" ADD CONSTRAINT "StockAuditLog_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAuditLog" ADD CONSTRAINT "StockAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
