-- Add tenant-controlled Factory Board public access settings.
ALTER TABLE "Tenant"
ADD COLUMN "factoryBoardEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "factoryBoardToken" TEXT;

CREATE UNIQUE INDEX "Tenant_factoryBoardToken_key" ON "Tenant"("factoryBoardToken");
