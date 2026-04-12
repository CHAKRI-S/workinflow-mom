-- AlterTable
ALTER TABLE "BomLine" ADD COLUMN     "materialSize" TEXT,
ADD COLUMN     "materialType" TEXT,
ADD COLUMN     "piecesPerStock" INTEGER;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "cycleTimeMinutes" DECIMAL(8,2);

-- AlterTable
ALTER TABLE "WorkOrder" ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;
