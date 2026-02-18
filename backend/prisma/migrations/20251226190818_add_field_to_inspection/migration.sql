-- AlterTable
ALTER TABLE "Inspection" ADD COLUMN     "nextInspect" TIMESTAMP(3),
ALTER COLUMN "scheduledAt" DROP NOT NULL;
