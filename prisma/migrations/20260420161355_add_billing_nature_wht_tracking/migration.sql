-- CreateEnum
CREATE TYPE "BillingNature" AS ENUM ('GOODS', 'MANUFACTURING_SERVICE', 'MIXED');

-- CreateEnum
CREATE TYPE "DrawingSource" AS ENUM ('TENANT_OWNED', 'CUSTOMER_PROVIDED', 'JOINT_DEVELOPMENT');

-- CreateEnum
CREATE TYPE "WhtCertStatus" AS ENUM ('NOT_APPLICABLE', 'PENDING', 'RECEIVED', 'VERIFIED', 'MISSING_OVERDUE');

-- AlterTable
ALTER TABLE "CreditNote" ADD COLUMN     "billingNature" "BillingNature" NOT NULL DEFAULT 'GOODS',
ADD COLUMN     "whtReversalAmount" DECIMAL(14,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "defaultBillingNature" "BillingNature" NOT NULL DEFAULT 'GOODS',
ADD COLUMN     "withholdsTax" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "billingNature" "BillingNature" NOT NULL DEFAULT 'GOODS',
ADD COLUMN     "whtAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "whtCertFileUrl" TEXT,
ADD COLUMN     "whtCertNumber" TEXT,
ADD COLUMN     "whtCertReceivedAt" TIMESTAMP(3),
ADD COLUMN     "whtCertStatus" "WhtCertStatus" NOT NULL DEFAULT 'NOT_APPLICABLE',
ADD COLUMN     "whtRate" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "InvoiceLine" ADD COLUMN     "customerBranding" JSONB,
ADD COLUMN     "customerDrawingUrl" TEXT,
ADD COLUMN     "drawingRevision" TEXT,
ADD COLUMN     "drawingSource" "DrawingSource" NOT NULL DEFAULT 'TENANT_OWNED',
ADD COLUMN     "lineBillingNature" "BillingNature",
ADD COLUMN     "productCode" TEXT;

-- AlterTable
ALTER TABLE "Receipt" ADD COLUMN     "billingNature" "BillingNature" NOT NULL DEFAULT 'GOODS',
ADD COLUMN     "grossAmount" DECIMAL(14,2),
ADD COLUMN     "whtAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "whtCertNumber" TEXT,
ADD COLUMN     "whtCertStatus" "WhtCertStatus" NOT NULL DEFAULT 'NOT_APPLICABLE',
ADD COLUMN     "whtRate" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "TaxInvoice" ADD COLUMN     "billingNature" "BillingNature" NOT NULL DEFAULT 'GOODS';

-- CreateIndex
CREATE INDEX "Invoice_tenantId_whtCertStatus_idx" ON "Invoice"("tenantId", "whtCertStatus");
