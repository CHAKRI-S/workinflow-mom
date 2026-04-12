import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";
import { generateDocNumber, DOC_PREFIX } from "@/lib/doc-numbering";

// POST /api/production/plans/schedule/add-wo — Create a Work Order from a Sales Order Line
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    requirePermission(session, ROLES.PLANNING);
    const tenantId = session!.user.tenantId;

    const body = await req.json();
    const {
      salesOrderLineId,
      cncMachineId,
      plannedStart,
      plannedEnd,
      plannedQty,
      color,
      materialSize,
      priority,
      materialStatus,
    } = body as {
      salesOrderLineId: string;
      cncMachineId: string;
      plannedStart: string;
      plannedEnd: string;
      plannedQty: number;
      color?: string;
      materialSize?: string;
      priority?: string;
      materialStatus?: string;
    };

    if (!salesOrderLineId || !cncMachineId || !plannedStart || !plannedEnd || !plannedQty) {
      return NextResponse.json(
        { error: "Missing required fields: salesOrderLineId, cncMachineId, plannedStart, plannedEnd, plannedQty" },
        { status: 400 }
      );
    }

    // Get the SO Line with product and sales order info
    const soLine = await prisma.salesOrderLine.findUnique({
      where: { id: salesOrderLineId },
      include: {
        product: { select: { id: true, code: true, name: true } },
        salesOrder: { select: { id: true, orderNumber: true, status: true, tenantId: true } },
      },
    });

    if (!soLine || soLine.salesOrder.tenantId !== tenantId) {
      return NextResponse.json({ error: "Sales order line not found" }, { status: 404 });
    }

    // Verify SO status is schedulable
    const schedulableStatuses = [
      "CONFIRMED",
      "DEPOSIT_PENDING",
      "IN_PRODUCTION",
      "PAINTING",
      "ENGRAVING",
      "QC_FINAL",
      "PACKING",
      "AWAITING_PAYMENT",
    ];
    if (!schedulableStatuses.includes(soLine.salesOrder.status)) {
      return NextResponse.json(
        { error: "Sales order is not in a schedulable status" },
        { status: 400 }
      );
    }

    // Verify machine belongs to tenant
    const machine = await prisma.cncMachine.findFirst({
      where: { id: cncMachineId, tenantId, isActive: true },
    });
    if (!machine) {
      return NextResponse.json({ error: "Machine not found" }, { status: 404 });
    }

    // Generate WO number
    const woNumber = await generateDocNumber(tenantId, DOC_PREFIX.WORK_ORDER);

    // Get max sortOrder for this machine
    const maxSort = await prisma.workOrder.aggregate({
      where: { cncMachineId, tenantId },
      _max: { sortOrder: true },
    });
    const sortOrder = (maxSort._max.sortOrder ?? -1) + 1;

    // Create the work order
    const workOrder = await prisma.workOrder.create({
      data: {
        woNumber,
        productId: soLine.productId,
        cncMachineId,
        plannedQty,
        plannedStart: new Date(plannedStart),
        plannedEnd: new Date(plannedEnd),
        color: color || soLine.color || null,
        materialSize: materialSize || null,
        priority: (priority as "LOW" | "NORMAL" | "HIGH" | "URGENT") || "NORMAL",
        materialStatus: (materialStatus as "READY" | "ORDERED" | "NOT_ORDERED" | "PARTIAL") || "NOT_ORDERED",
        sortOrder,
        tenantId,
      },
      include: {
        product: {
          select: { id: true, code: true, name: true, cycleTimeMinutes: true, category: true },
        },
        cncMachine: {
          select: { id: true, code: true, name: true },
        },
      },
    });

    return NextResponse.json(JSON.parse(JSON.stringify(workOrder)), { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("POST /api/production/plans/schedule/add-wo error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
