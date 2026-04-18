import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";
import { requireMachineAvailable, planLimitResponse } from "@/lib/plan-limits";

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
  try {
    const session = await auth();
    requirePermission(session, ROLES.PLANNING);

    const body = await req.json();
    const { code, name, type, description, status } = body;

    // Plan limit check
    await requireMachineAvailable(session!.user.tenantId);

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
  } catch (err) {
    const limitRes = planLimitResponse(err);
    if (limitRes) return limitRes;
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    console.error("POST /api/production/machines error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
