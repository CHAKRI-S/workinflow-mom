import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";

// GET /api/production/machines
export async function GET() {
  const session = await auth();
  requirePermission(session, ROLES.PRODUCTION);

  const machines = await prisma.cncMachine.findMany({
    where: { tenantId: session!.user.tenantId, isActive: true },
    orderBy: { code: "asc" },
    include: {
      _count: { select: { workOrders: true, maintenanceLogs: true } },
    },
  });

  return NextResponse.json(machines);
}

// POST /api/production/machines
export async function POST(req: NextRequest) {
  const session = await auth();
  requirePermission(session, ROLES.PLANNING);

  const body = await req.json();
  const { code, name, type, description, status } = body;

  const machine = await prisma.cncMachine.create({
    data: {
      code,
      name,
      type,
      description: description || null,
      status: status || "AVAILABLE",
      tenantId: session!.user.tenantId,
    },
  });

  return NextResponse.json(machine, { status: 201 });
}
