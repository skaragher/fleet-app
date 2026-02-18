-- AlterEnum
ALTER TYPE "InsurancesType" ADD VALUE 'RC';

-- AlterTable
ALTER TABLE "InsurancePolicy" ADD COLUMN     "durationUnit" TEXT,
ADD COLUMN     "durationValue" INTEGER;
