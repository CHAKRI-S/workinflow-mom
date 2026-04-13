import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DEFAULT_TOKEN = "workinflow-factory-2026";

// GET /api/public/factory-board?token=xxx
// Public API for factory floor TV display — no auth, token-based access
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const token = searchParams.get("token");
    const expectedToken = process.env.FACTORY_BOARD_TOKEN || DEFAULT_TOKEN;

    if (!token || token !== expectedToken) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // Get the first active tenant (single-tenant deployment)
    const tenant = await prisma.tenant.findFirst({
      where: { isActive: true },
    });

    if (!tenant) {
      return NextResponse.json({ error: "No active tenant" }, { status: 404 });
    }

    const tenantId = tenant.id;

    // Get all active CNC machines
    const machines = await prisma.cncMachine.findMany({
      where: { tenantId, isActive: true },
      orderBy: { code: "asc" },
    });

    // Get all non-cancelled work orders with product info, BOM, and images
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
            defaultColor: true,
            defaultSurfaceFinish: true,
            drawingNotes: true,
            requiresPainting: true,
            images: {
              orderBy: { sortOrder: "asc" },
              select: {
                id: true,
                url: true,
                caption: true,
              },
            },
            bomLines: {
              orderBy: { sortOrder: "asc" },
              include: {
                material: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                    type: true,
                    specification: true,
                    dimensions: true,
                    unit: true,
                  },
                },
              },
            },
          },
        },
        cncMachine: {
          select: { id: true, code: true, name: true },
        },
      },
      orderBy: [
        { cncMachineId: "asc" },
        { sortOrder: "asc" },
        { plannedStart: "asc" },
      ],
    });

    // Get confirmed SOs not yet in production plan (pending queue)
    const pendingSOs = await prisma.salesOrder.findMany({
      where: {
        tenantId,
        status: { in: ["CONFIRMED", "DEPOSIT_PENDING"] },
      },
      include: {
        customer: { select: { id: true, code: true, name: true } },
        lines: {
          include: {
            product: { select: { id: true, code: true, name: true } },
          },
        },
      },
      orderBy: { orderDate: "asc" },
    });

    return NextResponse.json({
      machines: JSON.parse(JSON.stringify(machines)),
      workOrders: JSON.parse(JSON.stringify(workOrders)),
      pendingSOs: JSON.parse(JSON.stringify(pendingSOs)),
      serverTime: new Date().toISOString(),
    });
  } catch (error) {
    console.error("GET /api/public/factory-board error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
