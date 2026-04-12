import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";

// GET /api/production/materials
export async function GET() {
  const session = await auth();
  requirePermission(session, ROLES.PRODUCTION);

  const materials = await prisma.material.findMany({
    where: { tenantId: session!.user.tenantId, isActive: true },
    orderBy: { code: "asc" },
  });

  return NextResponse.json(JSON.parse(JSON.stringify(materials)));
}

// POST /api/production/materials
export async function POST(req: NextRequest) {
  const session = await auth();
  requirePermission(session, ROLES.PLANNING);

  const body = await req.json();

  const {
    code,
    name,
    type,
    specification,
    unit,
    dimensions,
    stockQty,
    minStockQty,
    unitCost,
    supplierId,
  } = body;

  if (!code || !name) {
    return NextResponse.json(
      { error: "Code and name are required" },
      { status: 400 }
    );
  }

  try {
    const material = await prisma.material.create({
      data: {
        code,
        name,
        type: type || null,
        specification: specification || null,
        unit: unit || "PCS",
        dimensions: dimensions || null,
        stockQty: stockQty ?? 0,
        minStockQty: minStockQty ?? 0,
        unitCost: unitCost ?? null,
        supplierId: supplierId || null,
        tenantId: session!.user.tenantId,
      },
    });

    return NextResponse.json(JSON.parse(JSON.stringify(material)), {
      status: 201,
    });
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      err.message.includes("Unique constraint")
    ) {
      return NextResponse.json(
        { error: "Material code already exists" },
        { status: 409 }
      );
    }
    throw err;
  }
}
