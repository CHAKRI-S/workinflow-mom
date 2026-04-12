import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";
import { z } from "zod";
import type { WorkOrderStatus } from "@/generated/prisma/client";

type Params = { params: Promise<{ id: string }> };

const statusChangeSchema = z.object({
  status: z.enum([
    "PENDING",
    "RELEASED",
    "IN_PROGRESS",
    "QC_MACHINING",
    "SENT_TO_PAINTING",
    "PAINTING_DONE",
    "ENGRAVING",
    "QC_FINAL",
    "COMPLETED",
    "ON_HOLD",
    "CANCELLED",
  ]),
  qtyReported: z.number().optional(),
  scrapQty: z.number().optional(),
  note: z.string().optional(),
});

// Valid status transitions
const VALID_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["RELEASED", "CANCELLED"],
  RELEASED: ["IN_PROGRESS", "ON_HOLD", "CANCELLED"],
  IN_PROGRESS: [
    "QC_MACHINING",
    "SENT_TO_PAINTING",
    "ENGRAVING",
    "QC_FINAL",
    "COMPLETED",
    "ON_HOLD",
    "CANCELLED",
  ],
  QC_MACHINING: [
    "IN_PROGRESS",
    "SENT_TO_PAINTING",
    "ENGRAVING",
    "QC_FINAL",
    "COMPLETED",
    "ON_HOLD",
    "CANCELLED",
  ],
  SENT_TO_PAINTING: ["PAINTING_DONE", "ON_HOLD", "CANCELLED"],
  PAINTING_DONE: [
    "ENGRAVING",
    "QC_FINAL",
    "COMPLETED",
    "ON_HOLD",
    "CANCELLED",
  ],
  ENGRAVING: ["QC_FINAL", "COMPLETED", "ON_HOLD", "CANCELLED"],
  QC_FINAL: ["COMPLETED", "IN_PROGRESS", "ON_HOLD", "CANCELLED"],
  ON_HOLD: [
    "RELEASED",
    "IN_PROGRESS",
    "QC_MACHINING",
    "SENT_TO_PAINTING",
    "PAINTING_DONE",
    "ENGRAVING",
    "QC_FINAL",
    "CANCELLED",
  ],
};

// PATCH /api/production/work-orders/[id]/status — change status
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    requirePermission(session, ROLES.PRODUCTION);
    const { id } = await params;
    const tenantId = session!.user.tenantId;

    const body = await req.json();
    const { status: newStatus, qtyReported, scrapQty, note } =
      statusChangeSchema.parse(body);

    const workOrder = await prisma.workOrder.findFirst({
      where: { id, tenantId },
    });

    if (!workOrder) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const currentStatus = workOrder.status;

    // CANCELLED and COMPLETED are terminal
    if (currentStatus === "CANCELLED" || currentStatus === "COMPLETED") {
      return NextResponse.json(
        { error: `Cannot transition from ${currentStatus}` },
        { status: 400 }
      );
    }

    // Validate transition
    const allowed = VALID_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(newStatus)) {
      return NextResponse.json(
        {
          error: `Invalid transition: ${currentStatus} -> ${newStatus}`,
          allowedTransitions: allowed,
        },
        { status: 400 }
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = {
      status: newStatus as WorkOrderStatus,
    };

    // If completing, set actualEnd
    if (newStatus === "COMPLETED") {
      updateData.actualEnd = new Date();
    }

    // If starting production and no actualStart yet, set it
    if (newStatus === "IN_PROGRESS" && !workOrder.actualStart) {
      updateData.actualStart = new Date();
    }

    // If sending to painting, set sentToPaintingDate
    if (newStatus === "SENT_TO_PAINTING" && !workOrder.sentToPaintingDate) {
      updateData.sentToPaintingDate = new Date();
    }

    // If painting done, set paintingReceivedDate
    if (newStatus === "PAINTING_DONE" && !workOrder.paintingReceivedDate) {
      updateData.paintingReceivedDate = new Date();
    }

    // Update completedQty and scrapQty if reported
    if (qtyReported !== undefined) {
      updateData.completedQty = qtyReported;
    }
    if (scrapQty !== undefined) {
      updateData.scrapQty = scrapQty;
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Create status log entry
      await tx.workOrderLog.create({
        data: {
          workOrderId: id,
          fromStatus: currentStatus,
          toStatus: newStatus as WorkOrderStatus,
          qtyReported: qtyReported ?? null,
          scrapQty: scrapQty ?? null,
          note: note || null,
          createdById: session!.user.id,
        },
      });

      // Update work order
      const result = await tx.workOrder.update({
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

      return result;
    });

    return NextResponse.json(JSON.parse(JSON.stringify(updated)));
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    if (err instanceof Error && err.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid request data" },
        { status: 400 }
      );
    }
    console.error("PATCH /api/production/work-orders/[id]/status error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
