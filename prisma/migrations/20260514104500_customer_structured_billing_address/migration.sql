-- Add nullable structured Thai billing address fields for Customer.
-- Non-destructive: existing billingAddress remains the source for documents/PDFs.
ALTER TABLE "Customer"
  ADD COLUMN "billingSubdistrict" TEXT,
  ADD COLUMN "billingDistrict" TEXT,
  ADD COLUMN "billingProvince" TEXT,
  ADD COLUMN "billingPostalCode" TEXT;
