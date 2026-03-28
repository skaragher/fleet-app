-- CreateEnum
CREATE TYPE "VehicleCategory" AS ENUM ('CITADINE', 'BERLINE_SUV', 'PICKUP_4X4', 'PETIT_CAMION', 'POIDS_LOURD', 'GROS_PORTEUR');

-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN "category" "VehicleCategory";
