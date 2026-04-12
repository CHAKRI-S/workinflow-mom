import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";
import { productCreateSchema } from "@/lib/validators/product";

// GET /api/production/products
export async function GET() {
  const session = await auth();
  requirePermission(session, ROLES.ALL);

  const products = await prisma.product.findMany({
    where: { tenantId: session!.user.tenantId, isActive: true },
    orderBy: { code: "asc" },
    include: {
      _count: { select: { bomLines: true, workOrders: true } },
    },
  });

  return NextResponse.json(products);
}

// POST /api/production/products
export async function POST(req: NextRequest) {
  const session = await auth();
  requirePermission(session, ROLES.PLANNING);

  const body = await req.json();
  const data = productCreateSchema.parse(body);

  const product = await prisma.product.create({
    data: {
      ...data,
      tenantId: session!.user.tenantId,
    },
  });

  return NextResponse.json(product, { status: 201 });
}
