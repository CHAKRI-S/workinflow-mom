import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };

const workOrderUpdateSchema = z.object({
  cncMachineId: z.string().optional().nullable(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
  plannedQty: z.number().positive().optional(),
  plannedStart: z.string().optional(),
  plannedEnd: z.string().optional(),
  color: z.string().optional().nullable(),
  materialSize: z.string().optional().nullable(),
  fusionFileName: z.string().optional().nullable(),
  assignedTo: z.string().optional().nullable(),
  workCenter: z.string().optional().nullable(),
  sortOrder: z.number().optional(),
  notes: z.string().optional().nullable(),
  paintingVendor: z.string().optional().nullable(),
  sentToPaintingDate: z.string().optional().nullable(),
  paintingExpectedDate: z.string().optional().nullable(),
  paintingReceivedDate: z.string().optional().nullable(),
});

// GET /api/production/work-orders/[id] — get work order detail
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    requirePermission(session, ROLES.PRODUCTION);
    const { id } = await params;

    const workOrder = await prisma.workOrder.findFirst({
      where: { id, tenantId: session!.user.tenantId },
      include: {
        product: {
          select: {
            id: true,
            code: true,
            name: true,
            requiresPainting: true,
            requiresLogoEngraving: true,
          },
        },
        cncMachine: {
          select: { id: true, code: true, name: true },
        },
        logs: {
          orderBy: { createdAt: "desc" },
          include: {
            createdBy: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!workOrder) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(JSON.parse(JSON.stringify(workOrder)));
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    console.error("GET /api/production/work-orders/[id] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH /api/production/work-orders/[id] — update work order fields
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    requirePermission(session, ROLES.PRODUCTION);
    const { id } = await params;
    const tenantId = session!.user.tenantId;

    const existing = await prisma.workOrder.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();
    const data = workOrderUpdateSchema.parse(body);

    const updateData: Record<string, unknown> = {};

    if (data.cncMachineId !== undefined)
      updateData.cncMachineId = data.cncMachineId;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.plannedQty !== undefined) updateData.plannedQty = data.plannedQty;
    if (data.plannedStart !== undefined)
      updateData.plannedStart = new Date(data.plannedStart);
    if (data.plannedEnd !== undefined)
      updateData.plannedEnd = new Date(data.plannedEnd);
    if (data.color !== undefined) updateData.color = data.color;
    if (data.materialSize !== undefined)
      updateData.materialSize = data.materialSize;
    if (data.fusionFileName !== undefined)
      updateData.fusionFileName = data.fusionFileName;
    if (data.assignedTo !== undefined) updateData.assignedTo = data.assignedTo;
    if (data.workCenter !== undefined) updateData.workCenter = data.workCenter;
    if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.paintingVendor !== undefined)
      updateData.paintingVendor = data.paintingVendor;
    if (data.sentToPaintingDate !== undefined)
      updateData.sentToPaintingDate = data.sentToPaintingDate
        ? new Date(data.sentToPaintingDate)
        : null;
    if (data.paintingExpectedDate !== undefined)
      updateData.paintingExpectedDate = data.paintingExpectedDate
        ? new Date(data.paintingExpectedDate)
        : null;
    if (data.paintingReceivedDate !== undefined)
      updateData.paintingReceivedDate = data.paintingReceivedDate
        ? new Date(data.paintingReceivedDate)
        : null;

    const updated = await prisma.workOrder.update({
      where: { id },
      data: updateData,
      include: {
        product: {
          select: {
            id: true,
            code: true,
            name: true,
            requiresPainting: true,
            requiresLogoEngraving: true,
          },
        },
        cncMachine: {
          select: { id: true, code: true, name: true },
        },
        logs: {
          orderBy: { createdAt: "desc" },
          include: {
            createdBy: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    return NextResponse.json(JSON.parse(JSON.stringify(updated)));
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
    console.error("PATCH /api/production/work-orders/[id] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
