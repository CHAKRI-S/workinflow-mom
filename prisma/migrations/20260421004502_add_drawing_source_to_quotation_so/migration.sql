-- AlterTable
ALTER TABLE "Quotation" ADD COLUMN     "billingNature" "BillingNature" NOT NULL DEFAULT 'GOODS';

-- AlterTable
ALTER TABLE "QuotationLine" ADD COLUMN     "customerBranding" JSONB,
ADD COLUMN     "customerDrawingUrl" TEXT,
ADD COLUMN     "drawingRevision" TEXT,
ADD COLUMN     "drawingSource" "DrawingSource" NOT NULL DEFAULT 'TENANT_OWNED',
ADD COLUMN     "lineBillingNature" "BillingNature",
ADD COLUMN     "productCode" TEXT;

-- AlterTable
ALTER TABLE "SalesOrder" ADD COLUMN     "billingNature" "BillingNature" NOT NULL DEFAULT 'GOODS';

-- AlterTable
ALTER TABLE "SalesOrderLine" ADD COLUMN     "customerBranding" JSONB,
ADD COLUMN     "customerDrawingUrl" TEXT,
ADD COLUMN     "drawingRevision" TEXT,
ADD COLUMN     "drawingSource" "DrawingSource" NOT NULL DEFAULT 'TENANT_OWNED',
ADD COLUMN     "lineBillingNature" "BillingNature",
ADD COLUMN     "productCode" TEXT;
