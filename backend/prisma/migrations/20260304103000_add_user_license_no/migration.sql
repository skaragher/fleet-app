-- Add license number on users for driver authentication
ALTER TABLE "User"
ADD COLUMN "licenseNo" TEXT;

CREATE UNIQUE INDEX "User_licenseNo_key" ON "User"("licenseNo");
