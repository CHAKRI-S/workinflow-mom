/*
  Warnings:

  - Added the required column `scheduledDate` to the `MaintenanceLog` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "MaintenanceStatus" AS ENUM ('SCHEDULED', 'OVERDUE', 'IN_PROGRESS', 'COMPLETED');

-- AlterTable
ALTER TABLE "MaintenanceLog" ADD COLUMN     "scheduledDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "status" "MaintenanceStatus" NOT NULL DEFAULT 'SCHEDULED',
ALTER COLUMN "startDate" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "MaintenanceLog_status_idx" ON "MaintenanceLog"("status");
