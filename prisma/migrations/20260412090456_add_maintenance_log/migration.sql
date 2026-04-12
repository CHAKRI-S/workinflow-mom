-- CreateEnum
CREATE TYPE "MaintenanceType" AS ENUM ('PREVENTIVE', 'CORRECTIVE', 'INSPECTION', 'CALIBRATION');

-- CreateTable
CREATE TABLE "MaintenanceLog" (
    "id" TEXT NOT NULL,
    "cncMachineId" TEXT NOT NULL,
    "type" "MaintenanceType" NOT NULL DEFAULT 'CORRECTIVE',
    "description" TEXT NOT NULL,
    "performedBy" TEXT,
    "cost" DECIMAL(12,2),
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "notes" TEXT,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MaintenanceLog_cncMachineId_idx" ON "MaintenanceLog"("cncMachineId");

-- CreateIndex
CREATE INDEX "MaintenanceLog_tenantId_idx" ON "MaintenanceLog"("tenantId");

-- AddForeignKey
ALTER TABLE "MaintenanceLog" ADD CONSTRAINT "MaintenanceLog_cncMachineId_fkey" FOREIGN KEY ("cncMachineId") REFERENCES "CncMachine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
