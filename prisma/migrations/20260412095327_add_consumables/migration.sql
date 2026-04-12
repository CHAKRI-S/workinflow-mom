-- CreateEnum
CREATE TYPE "ConsumableCategory" AS ENUM ('CUTTING_TOOL', 'COOLANT', 'ABRASIVE', 'MEASURING', 'SAFETY', 'OTHER');

-- CreateEnum
CREATE TYPE "POLineType" AS ENUM ('MATERIAL', 'CONSUMABLE', 'OTHER');

-- AlterTable
ALTER TABLE "PurchaseOrderLine" ADD COLUMN     "consumableId" TEXT,
ADD COLUMN     "lineType" "POLineType" NOT NULL DEFAULT 'OTHER';

-- CreateTable
CREATE TABLE "Consumable" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "ConsumableCategory" NOT NULL DEFAULT 'OTHER',
    "brand" TEXT,
    "specification" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'PCS',
    "lastPrice" DECIMAL(12,2),
    "lastSupplier" TEXT,
    "lastPurchaseDate" TIMESTAMP(3),
    "stockQty" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "minStockQty" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Consumable_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Consumable_tenantId_idx" ON "Consumable"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Consumable_tenantId_code_key" ON "Consumable"("tenantId", "code");

-- AddForeignKey
ALTER TABLE "Consumable" ADD CONSTRAINT "Consumable_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_consumableId_fkey" FOREIGN KEY ("consumableId") REFERENCES "Consumable"("id") ON DELETE SET NULL ON UPDATE CASCADE;
