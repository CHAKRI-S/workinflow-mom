-- Add VAT price mode support.
-- Existing records stay VAT-exclusive through defaults; enteredUnitPrice remains
-- nullable so old line rows do not need a backfill to deploy safely.

CREATE TYPE "VatPriceMode" AS ENUM ('EXCLUSIVE', 'INCLUSIVE');
CREATE TYPE "VatModePolicy" AS ENUM ('PER_LINE', 'FORCE_EXCLUSIVE', 'FORCE_INCLUSIVE');

ALTER TABLE "Product"
ADD COLUMN "defaultVatPriceMode" "VatPriceMode" NOT NULL DEFAULT 'EXCLUSIVE';

ALTER TABLE "Quotation"
ADD COLUMN "vatModePolicy" "VatModePolicy" NOT NULL DEFAULT 'PER_LINE';

ALTER TABLE "QuotationLine"
ADD COLUMN "enteredUnitPrice" DECIMAL(12,2),
ADD COLUMN "vatPriceMode" "VatPriceMode" NOT NULL DEFAULT 'EXCLUSIVE';

ALTER TABLE "SalesOrder"
ADD COLUMN "vatModePolicy" "VatModePolicy" NOT NULL DEFAULT 'PER_LINE';

ALTER TABLE "SalesOrderLine"
ADD COLUMN "enteredUnitPrice" DECIMAL(12,2),
ADD COLUMN "vatPriceMode" "VatPriceMode" NOT NULL DEFAULT 'EXCLUSIVE';

ALTER TABLE "Invoice"
ADD COLUMN "vatModePolicy" "VatModePolicy" NOT NULL DEFAULT 'PER_LINE';

ALTER TABLE "InvoiceLine"
ADD COLUMN "enteredUnitPrice" DECIMAL(12,2),
ADD COLUMN "vatPriceMode" "VatPriceMode" NOT NULL DEFAULT 'EXCLUSIVE';

ALTER TABLE "CreditNote"
ADD COLUMN "vatModePolicy" "VatModePolicy" NOT NULL DEFAULT 'PER_LINE';

ALTER TABLE "CreditNoteLine"
ADD COLUMN "enteredUnitPrice" DECIMAL(12,2),
ADD COLUMN "vatPriceMode" "VatPriceMode" NOT NULL DEFAULT 'EXCLUSIVE';
