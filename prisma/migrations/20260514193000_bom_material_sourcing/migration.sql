-- Add BOM material sourcing mode per line.
CREATE TYPE "BomMaterialSourcing" AS ENUM ('STOCK_CUT', 'JOB_SPECIFIC');

ALTER TABLE "BomLine"
  ADD COLUMN "sourcing" "BomMaterialSourcing" NOT NULL DEFAULT 'STOCK_CUT';
