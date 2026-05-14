-- CreateEnum
CREATE TYPE "ProductKind" AS ENUM ('GOODS', 'SERVICE');

-- AlterTable
ALTER TABLE "Product"
ADD COLUMN     "productKind" "ProductKind" NOT NULL DEFAULT 'GOODS',
ADD COLUMN     "drawingSource" "DrawingSource" NOT NULL DEFAULT 'TENANT_OWNED',
ADD COLUMN     "drawingRevision" TEXT,
ADD COLUMN     "customerDrawingUrl" TEXT;
