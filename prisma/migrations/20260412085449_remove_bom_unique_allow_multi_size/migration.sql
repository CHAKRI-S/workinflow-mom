-- DropIndex
DROP INDEX "BomLine_productId_materialId_key";

-- CreateIndex
CREATE INDEX "BomLine_materialId_idx" ON "BomLine"("materialId");
