-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "brandingAssets" JSONB;

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "omiseCustomerId" TEXT,
ADD COLUMN     "omiseDefaultCardBrand" TEXT,
ADD COLUMN     "omiseDefaultCardId" TEXT,
ADD COLUMN     "omiseDefaultCardLast4" TEXT;
