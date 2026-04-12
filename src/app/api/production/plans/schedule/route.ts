import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";

// GET /api/production/plans/schedule — Get timeline data (machines + work orders)
export async function GET() {
  try {
    const session = await auth();
    requirePermission(session, ROLES.PLANNING);
    const tenantId = session!.user.tenantId;

    // Get all active CNC machines
    const machines = await prisma.cncMachine.findMany({
      where: { tenantId, isActive: true },
      orderBy: { code: "asc" },
    });

    // Get all non-cancelled work orders with product info
    const workOrders = await prisma.workOrder.findMany({
      where: {
        tenantId,
        status: { not: "CANCELLED" },
      },
      include: {
        product: {
          select: {
            id: true,
            code: true,
            name: true,
            cycleTimeMinutes: true,
            category: true,
          },
        },
        cncMachine: {
          select: { id: true, code: true, name: true },
        },
      },
      orderBy: [{ cncMachineId: "asc" }, { sortOrder: "asc" }, { plannedStart: "asc" }],
    });

    return NextResponse.json({
      machines: JSON.parse(JSON.stringify(machines)),
      workOrders: JSON.parse(JSON.stringify(workOrders)),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/production/plans/schedule error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/production/plans/schedule — Reorder work orders (drag-drop)
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    requirePermission(session, ROLES.PLANNING);
    const tenantId = session!.user.tenantId;

    const body = await req.json();
    // body: { updates: [{ workOrderId, cncMachineId, sortOrder }] }
    const { updates } = body as {
      updates: { workOrderId: string; cncMachineId: string | null; sortOrder: number }[];
    };

    if (!updates || !Array.isArray(updates)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    // Verify all WOs belong to this tenant and update in transaction
    await prisma.$transaction(async (tx) => {
      for (const update of updates) {
        await tx.workOrder.updateMany({
          where: { id: update.workOrderId, tenantId },
          data: {
            cncMachineId: update.cncMachineId,
            sortOrder: update.sortOrder,
          },
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("PATCH /api/production/plans/schedule error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
