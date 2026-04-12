import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";

type Params = { params: Promise<{ id: string }> };

// GET /api/production/materials/[id]
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  requirePermission(session, ROLES.PRODUCTION);
  const { id } = await params;

  const material = await prisma.material.findFirst({
    where: { id, tenantId: session!.user.tenantId, isActive: true },
    include: {
      bomLines: {
        include: {
          product: { select: { id: true, code: true, name: true } },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!material) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(JSON.parse(JSON.stringify(material)));
}

// PATCH /api/production/materials/[id]
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  requirePermission(session, ROLES.PLANNING);
  const { id } = await params;

  const body = await req.json();

  const allowedFields = [
    "code",
    "name",
    "type",
    "specification",
    "unit",
    "dimensions",
    "stockQty",
    "minStockQty",
    "unitCost",
    "supplierId",
  ];

  const data: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (key in body) {
      data[key] = body[key];
    }
  }

  const result = await prisma.material.updateMany({
    where: { id, tenantId: session!.user.tenantId, isActive: true },
    data,
  });

  if (result.count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

// DELETE /api/production/materials/[id] — soft delete
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  requirePermission(session, ROLES.PLANNING);
  const { id } = await params;

  await prisma.material.updateMany({
    where: { id, tenantId: session!.user.tenantId },
    data: { isActive: false },
  });

  return NextResponse.json({ success: true });
}
