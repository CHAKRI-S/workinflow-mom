import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";

type Params = { params: Promise<{ id: string }> };

// GET /api/production/machines/[id]/maintenance
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  requirePermission(session, ROLES.PRODUCTION);
  const { id } = await params;

  const logs = await prisma.maintenanceLog.findMany({
    where: {
      cncMachineId: id,
      tenantId: session!.user.tenantId,
    },
    orderBy: { scheduledDate: "desc" },
  });

  return NextResponse.json(JSON.parse(JSON.stringify(logs)));
}

// POST /api/production/machines/[id]/maintenance
export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  requirePermission(session, ROLES.PLANNING);
  const { id } = await params;

  const body = await req.json();
  const { type, status, description, performedBy, cost, scheduledDate, startDate, endDate, notes } = body;

  const log = await prisma.maintenanceLog.create({
    data: {
      cncMachineId: id,
      type: type || "PREVENTIVE",
      status: status || "SCHEDULED",
      description,
      performedBy: performedBy || null,
      cost: cost ? parseFloat(cost) : null,
      scheduledDate: new Date(scheduledDate),
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      notes: notes || null,
      tenantId: session!.user.tenantId,
    },
  });

  return NextResponse.json(JSON.parse(JSON.stringify(log)), { status: 201 });
}
