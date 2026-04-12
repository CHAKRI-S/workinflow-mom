import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";
import { productUpdateSchema } from "@/lib/validators/product";

type Params = { params: Promise<{ id: string }> };

// GET /api/production/products/[id]
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  requirePermission(session, ROLES.ALL);
  const { id } = await params;

  const product = await prisma.product.findFirst({
    where: { id, tenantId: session!.user.tenantId },
    include: {
      bomLines: {
        include: { material: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!product) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(product);
}

// PATCH /api/production/products/[id]
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  requirePermission(session, ROLES.PLANNING);
  const { id } = await params;

  const body = await req.json();
  const data = productUpdateSchema.parse(body);

  const product = await prisma.product.updateMany({
    where: { id, tenantId: session!.user.tenantId },
    data,
  });

  if (product.count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

// DELETE /api/production/products/[id] — soft delete
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  requirePermission(session, ROLES.MANAGEMENT);
  const { id } = await params;

  await prisma.product.updateMany({
    where: { id, tenantId: session!.user.tenantId },
    data: { isActive: false },
  });

  return NextResponse.json({ success: true });
}
