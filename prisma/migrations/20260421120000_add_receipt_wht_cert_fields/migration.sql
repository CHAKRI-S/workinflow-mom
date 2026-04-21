-- AlterTable: add WHT cert tracking fields to Receipt (Phase 8C)
ALTER TABLE "Receipt" ADD COLUMN "whtCertReceivedAt" TIMESTAMP(3);
ALTER TABLE "Receipt" ADD COLUMN "whtCertFileUrl" TEXT;
