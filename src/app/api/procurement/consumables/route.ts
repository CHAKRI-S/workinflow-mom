import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";
import {
  createWithGeneratedCode,
  generateConsumableCode,
} from "@/lib/code-gen";

// GET /api/procurement/consumables — list all consumables for tenant
export async function GET() {
  try {
    const session = await auth();
    requirePermission(session, ROLES.PLANNING);

    const consumables = await prisma.consumable.findMany({
      where: { tenantId: session!.user.tenantId, isActive: true },
      orderBy: { code: "asc" },
    });

    return NextResponse.json(JSON.parse(JSON.stringify(consumables)));
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    console.error("GET /api/procurement/consumables error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/procurement/consumables — create new consumable
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    requirePermission(session, ROLES.PLANNING);

    const body = await req.json();
    const {
      code: _ignoredCode,
      name,
      category,
      brand,
      specification,
      unit,
      stockQty,
      minStockQty,
    } = body;
    void _ignoredCode;

    if (!name) {
      return NextResponse.json(
        { error: "name is required" },
        { status: 400 }
      );
    }

    const tenantId = session!.user.tenantId;
    const consumable = await createWithGeneratedCode({
      generate: () => generateConsumableCode(tenantId),
      create: (code) =>
        prisma.consumable.create({
          data: {
            code,
            name,
            category: category || "OTHER",
            brand: brand || null,
            specification: specification || null,
            unit: unit || "PCS",
            stockQty: stockQty ?? 0,
            minStockQty: minStockQty ?? 0,
            tenantId,
          },
        }),
    });

    return NextResponse.json(JSON.parse(JSON.stringify(consumable)), {
      status: 201,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    console.error("POST /api/procurement/consumables error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
