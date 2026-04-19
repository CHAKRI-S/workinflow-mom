-- CreateEnum
CREATE TYPE "JuristicType" AS ENUM (
  'COMPANY_LTD',
  'PUBLIC_CO',
  'LIMITED_PARTNERSHIP',
  'FOUNDATION',
  'ASSOCIATION',
  'JOINT_VENTURE',
  'OTHER_JURISTIC',
  'INDIVIDUAL'
);

-- AlterTable: Tenant
ALTER TABLE "Tenant"
  ADD COLUMN "branchNo"     TEXT,
  ADD COLUMN "juristicType" "JuristicType",
  ADD COLUMN "country"      TEXT NOT NULL DEFAULT 'TH';

-- AlterTable: Customer
ALTER TABLE "Customer"
  ADD COLUMN "juristicType" "JuristicType",
  ADD COLUMN "country"      TEXT NOT NULL DEFAULT 'TH',
  ADD COLUMN "branchNo"     TEXT;
