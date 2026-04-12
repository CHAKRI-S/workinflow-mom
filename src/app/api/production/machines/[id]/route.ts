import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";

type Params = { params: Promise<{ id: string }> };

// GET /api/production/machines/[id]
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  requirePermission(session, ROLES.PRODUCTION);
  const { id } = await params;

  const machine = await prisma.cncMachine.findFirst({
    where: { id, tenantId: session!.user.tenantId, isActive: true },
    include: {
      maintenanceLogs: {
        orderBy: { startDate: "desc" },
      },
      _count: { select: { workOrders: true } },
    },
  });

  if (!machine) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(machine);
}

// PATCH /api/production/machines/[id]
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  requirePermission(session, ROLES.PLANNING);
  const { id } = await params;

  const body = await req.json();
  const { code, name, type, description, status } = body;

  const data: Record<string, unknown> = {};
  if (code !== undefined) data.code = code;
  if (name !== undefined) data.name = name;
  if (type !== undefined) data.type = type;
  if (description !== undefined) data.description = description;
  if (status !== undefined) data.status = status;

  const result = await prisma.cncMachine.updateMany({
    where: { id, tenantId: session!.user.tenantId },
    data,
  });

  if (result.count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

// DELETE /api/production/machines/[id] — soft delete
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  requirePermission(session, ROLES.PLANNING);
  const { id } = await params;

  await prisma.cncMachine.updateMany({
    where: { id, tenantId: session!.user.tenantId },
    data: { isActive: false },
  });

  return NextResponse.json({ success: true });
}
