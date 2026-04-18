import { NextRequest, NextResponse } from "next/server";
import type { MaintenanceStatus, MaintenanceType } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";

// GET /api/production/maintenance
export async function GET(req: NextRequest) {
  const session = await auth();
  requirePermission(session, ROLES.PRODUCTION);

  const { searchParams } = new URL(req.url);
  const machineId = searchParams.get("machineId") ?? undefined;
  const status = searchParams.get("status") ?? undefined;
  const type = searchParams.get("type") ?? undefined;

  const logs = await prisma.maintenanceLog.findMany({
    where: {
      tenantId: session!.user.tenantId,
      ...(machineId && { cncMachineId: machineId }),
      ...(status && { status: status as MaintenanceStatus }),
      ...(type && { type: type as MaintenanceType }),
    },
    include: {
      cncMachine: { select: { id: true, code: true, name: true } },
    },
    orderBy: { scheduledDate: "desc" },
  });

  return NextResponse.json(JSON.parse(JSON.stringify(logs)));
}
