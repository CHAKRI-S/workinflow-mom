-- Phase 8.12: VAT Registration Awareness
-- Add isVatRegistered flag on Tenant. Default true so existing tenants
-- keep emitting "ใบกำกับภาษี / ใบแจ้งหนี้" headers unchanged. Non-VAT
-- tenants (those who haven't registered for VAT or earn under 1.8M/year)
-- can toggle this off and the PDF title will drop "ใบกำกับภาษี".

ALTER TABLE "Tenant" ADD COLUMN "isVatRegistered" BOOLEAN NOT NULL DEFAULT true;
