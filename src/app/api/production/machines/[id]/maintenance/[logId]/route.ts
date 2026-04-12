import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";

type Params = { params: Promise<{ id: string; logId: string }> };

// PATCH /api/production/machines/[id]/maintenance/[logId]
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  requirePermission(session, ROLES.PLANNING);
  const { logId } = await params;

  const body = await req.json();
  const updateData: Record<string, unknown> = {};

  if (body.status) updateData.status = body.status;
  if (body.description !== undefined) updateData.description = body.description;
  if (body.performedBy !== undefined) updateData.performedBy = body.performedBy || null;
  if (body.cost !== undefined) updateData.cost = body.cost ? parseFloat(body.cost) : null;
  if (body.scheduledDate) updateData.scheduledDate = new Date(body.scheduledDate);
  if (body.startDate !== undefined) updateData.startDate = body.startDate ? new Date(body.startDate) : null;
  if (body.endDate !== undefined) updateData.endDate = body.endDate ? new Date(body.endDate) : null;
  if (body.notes !== undefined) updateData.notes = body.notes || null;

  // Auto-set dates on status change
  if (body.status === "IN_PROGRESS" && !body.startDate) {
    updateData.startDate = new Date();
  }
  if (body.status === "COMPLETED" && !body.endDate) {
    updateData.endDate = new Date();
  }

  const log = await prisma.maintenanceLog.update({
    where: { id: logId },
    data: updateData,
  });

  return NextResponse.json(JSON.parse(JSON.stringify(log)));
}

// DELETE /api/production/machines/[id]/maintenance/[logId]
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  requirePermission(session, ROLES.PLANNING);
  const { logId } = await params;

  await prisma.maintenanceLog.deleteMany({
    where: {
      id: logId,
      tenantId: session!.user.tenantId,
    },
  });

  return NextResponse.json({ success: true });
}
