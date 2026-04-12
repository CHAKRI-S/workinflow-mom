import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";

type Params = { params: Promise<{ id: string }> };

// GET /api/procurement/consumables/[id]
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    requirePermission(session, ROLES.PLANNING);
    const { id } = await params;

    const consumable = await prisma.consumable.findFirst({
      where: { id, tenantId: session!.user.tenantId, isActive: true },
    });

    if (!consumable) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(JSON.parse(JSON.stringify(consumable)));
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    console.error("GET /api/procurement/consumables/[id] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH /api/procurement/consumables/[id]
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    requirePermission(session, ROLES.PLANNING);
    const { id } = await params;

    const body = await req.json();
    const { code, name, category, brand, specification, unit, stockQty, minStockQty } = body;

    const data: Record<string, unknown> = {};
    if (code !== undefined) data.code = code;
    if (name !== undefined) data.name = name;
    if (category !== undefined) data.category = category;
    if (brand !== undefined) data.brand = brand || null;
    if (specification !== undefined) data.specification = specification || null;
    if (unit !== undefined) data.unit = unit;
    if (stockQty !== undefined) data.stockQty = stockQty;
    if (minStockQty !== undefined) data.minStockQty = minStockQty;

    const result = await prisma.consumable.updateMany({
      where: { id, tenantId: session!.user.tenantId },
      data,
    });

    if (result.count === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    console.error("PATCH /api/procurement/consumables/[id] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/procurement/consumables/[id] — soft delete
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    requirePermission(session, ROLES.PLANNING);
    const { id } = await params;

    await prisma.consumable.updateMany({
      where: { id, tenantId: session!.user.tenantId },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    console.error("DELETE /api/procurement/consumables/[id] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
