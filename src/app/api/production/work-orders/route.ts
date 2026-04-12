import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";
import { generateDocNumber, DOC_PREFIX } from "@/lib/doc-numbering";
import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";

const workOrderCreateSchema = z.object({
  productId: z.string().min(1),
  cncMachineId: z.string().optional().nullable(),
  productionPlanId: z.string().optional().nullable(),
  plannedQty: z.number().positive(),
  plannedStart: z.string().min(1),
  plannedEnd: z.string().min(1),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  color: z.string().optional().nullable(),
  materialSize: z.string().optional().nullable(),
  fusionFileName: z.string().optional().nullable(),
  assignedTo: z.string().optional().nullable(),
  workCenter: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// GET /api/production/work-orders — list all work orders for tenant
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    requirePermission(session, ROLES.PRODUCTION);

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const where: Prisma.WorkOrderWhereInput = {
      tenantId: session!.user.tenantId,
    };

    if (status && status !== "ALL") {
      where.status = status as Prisma.WorkOrderWhereInput["status"];
    }

    const workOrders = await prisma.workOrder.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        product: { select: { id: true, code: true, name: true } },
        cncMachine: { select: { id: true, code: true, name: true } },
      },
    });

    return NextResponse.json(JSON.parse(JSON.stringify(workOrders)));
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    console.error("GET /api/production/work-orders error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/production/work-orders — create new work order
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    requirePermission(session, ROLES.PRODUCTION);

    const body = await req.json();
    const data = workOrderCreateSchema.parse(body);
    const tenantId = session!.user.tenantId;

    const workOrder = await prisma.$transaction(async (tx) => {
      const woNumber = await generateDocNumber(tenantId, DOC_PREFIX.WORK_ORDER);

      const created = await tx.workOrder.create({
        data: {
          woNumber,
          tenantId,
          productId: data.productId,
          cncMachineId: data.cncMachineId || null,
          productionPlanId: data.productionPlanId || null,
          plannedQty: data.plannedQty,
          plannedStart: new Date(data.plannedStart),
          plannedEnd: new Date(data.plannedEnd),
          priority: data.priority,
          color: data.color || null,
          materialSize: data.materialSize || null,
          fusionFileName: data.fusionFileName || null,
          assignedTo: data.assignedTo || null,
          workCenter: data.workCenter || null,
          notes: data.notes || null,
        },
        include: {
          product: { select: { id: true, code: true, name: true } },
          cncMachine: { select: { id: true, code: true, name: true } },
        },
      });

      return created;
    });

    return NextResponse.json(JSON.parse(JSON.stringify(workOrder)), {
      status: 201,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    if (err instanceof Error && err.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation failed", details: err },
        { status: 400 }
      );
    }
    console.error("POST /api/production/work-orders error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
