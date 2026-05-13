-- Sprint 2: document tax type, document currency snapshots, and customer legal title fields.
-- Production deploy must be approval-gated; this file is generated locally only.

-- Extend JuristicType for new customer legal display-name options.
ALTER TYPE "JuristicType" ADD VALUE IF NOT EXISTS 'ORDINARY_PARTNERSHIP';
ALTER TYPE "JuristicType" ADD VALUE IF NOT EXISTS 'SHOP';
ALTER TYPE "JuristicType" ADD VALUE IF NOT EXISTS 'PERSON_GROUP';

-- New enums used by document snapshots and individual customer titles.
CREATE TYPE "DocumentTaxType" AS ENUM ('VAT_INCLUSIVE', 'VAT_EXCLUSIVE', 'NO_VAT');
CREATE TYPE "IndividualTitle" AS ENUM ('MR', 'MRS', 'MISS', 'KHUN', 'NONE', 'OTHER');

-- Customer legal-title metadata. Existing names are intentionally preserved.
ALTER TABLE "Customer"
  ADD COLUMN "individualTitle" "IndividualTitle",
  ADD COLUMN "individualTitleOther" TEXT;

-- Document-level tax type and display currency snapshots.
ALTER TABLE "Quotation"
  ADD COLUMN "taxType" "DocumentTaxType" NOT NULL DEFAULT 'VAT_EXCLUSIVE',
  ADD COLUMN "currencyCode" VARCHAR(3) NOT NULL DEFAULT 'THB';

ALTER TABLE "SalesOrder"
  ADD COLUMN "taxType" "DocumentTaxType" NOT NULL DEFAULT 'VAT_EXCLUSIVE',
  ADD COLUMN "currencyCode" VARCHAR(3) NOT NULL DEFAULT 'THB';

ALTER TABLE "Invoice"
  ADD COLUMN "taxType" "DocumentTaxType" NOT NULL DEFAULT 'VAT_EXCLUSIVE',
  ADD COLUMN "currencyCode" VARCHAR(3) NOT NULL DEFAULT 'THB';

ALTER TABLE "TaxInvoice"
  ADD COLUMN "taxType" "DocumentTaxType" NOT NULL DEFAULT 'VAT_EXCLUSIVE',
  ADD COLUMN "currencyCode" VARCHAR(3) NOT NULL DEFAULT 'THB';

ALTER TABLE "Receipt"
  ADD COLUMN "taxType" "DocumentTaxType" NOT NULL DEFAULT 'VAT_EXCLUSIVE',
  ADD COLUMN "currencyCode" VARCHAR(3) NOT NULL DEFAULT 'THB';

ALTER TABLE "CreditNote"
  ADD COLUMN "taxType" "DocumentTaxType" NOT NULL DEFAULT 'VAT_EXCLUSIVE',
  ADD COLUMN "currencyCode" VARCHAR(3) NOT NULL DEFAULT 'THB';

-- Backfill from legacy VAT fields where feasible. Currency defaults to THB for all existing rows.
UPDATE "Quotation"
SET "taxType" = CASE
  WHEN "vatRate" = 0 THEN 'NO_VAT'::"DocumentTaxType"
  WHEN "vatModePolicy" = 'FORCE_INCLUSIVE' THEN 'VAT_INCLUSIVE'::"DocumentTaxType"
  ELSE 'VAT_EXCLUSIVE'::"DocumentTaxType"
END;

UPDATE "SalesOrder"
SET "taxType" = CASE
  WHEN "vatRate" = 0 THEN 'NO_VAT'::"DocumentTaxType"
  WHEN "vatModePolicy" = 'FORCE_INCLUSIVE' THEN 'VAT_INCLUSIVE'::"DocumentTaxType"
  ELSE 'VAT_EXCLUSIVE'::"DocumentTaxType"
END;

UPDATE "Invoice"
SET "taxType" = CASE
  WHEN "vatRate" = 0 THEN 'NO_VAT'::"DocumentTaxType"
  WHEN "vatModePolicy" = 'FORCE_INCLUSIVE' THEN 'VAT_INCLUSIVE'::"DocumentTaxType"
  ELSE 'VAT_EXCLUSIVE'::"DocumentTaxType"
END;

UPDATE "TaxInvoice" ti
SET "taxType" = COALESCE(inv."taxType", CASE
  WHEN ti."vatRate" = 0 THEN 'NO_VAT'::"DocumentTaxType"
  ELSE 'VAT_EXCLUSIVE'::"DocumentTaxType"
END),
"currencyCode" = COALESCE(inv."currencyCode", 'THB')
FROM "Invoice" inv
WHERE ti."invoiceId" = inv."id";

UPDATE "Receipt" r
SET "taxType" = inv."taxType",
"currencyCode" = inv."currencyCode"
FROM "Invoice" inv
WHERE r."invoiceId" = inv."id";

UPDATE "CreditNote"
SET "taxType" = CASE
  WHEN "vatRate" = 0 THEN 'NO_VAT'::"DocumentTaxType"
  WHEN "vatModePolicy" = 'FORCE_INCLUSIVE' THEN 'VAT_INCLUSIVE'::"DocumentTaxType"
  ELSE 'VAT_EXCLUSIVE'::"DocumentTaxType"
END;
