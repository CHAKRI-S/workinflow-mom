-- CreateEnum
CREATE TYPE "MaterialReadiness" AS ENUM ('READY', 'ORDERED', 'NOT_ORDERED', 'PARTIAL');

-- AlterTable
ALTER TABLE "WorkOrder" ADD COLUMN     "materialStatus" "MaterialReadiness" NOT NULL DEFAULT 'NOT_ORDERED';
