import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";

type Params = { params: Promise<{ id: string }> };

// GET /api/procurement/purchase-orders/[id] — get PO detail with lines
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    requirePermission(session, ROLES.PLANNING);
    const { id } = await params;

    const purchaseOrder = await prisma.purchaseOrder.findFirst({
      where: { id, tenantId: session!.user.tenantId },
      include: {
        lines: {
          orderBy: { sortOrder: "asc" },
          include: {
            material: {
              select: { id: true, code: true, name: true, unit: true },
            },
          },
        },
      },
    });

    if (!purchaseOrder) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(JSON.parse(JSON.stringify(purchaseOrder)));
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    console.error("GET /api/procurement/purchase-orders/[id] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH /api/procurement/purchase-orders/[id] — update PO fields + status
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    requirePermission(session, ROLES.PLANNING);
    const { id } = await params;
    const tenantId = session!.user.tenantId;

    const existing = await prisma.purchaseOrder.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();
    const { status, supplierName, supplierContact, expectedDate, notes } = body;

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (status) {
      updateData.status = status;

      // If marking as RECEIVED, set receivedDate
      if (status === "RECEIVED") {
        updateData.receivedDate = new Date();
      }
    }

    if (supplierName !== undefined) updateData.supplierName = supplierName;
    if (supplierContact !== undefined)
      updateData.supplierContact = supplierContact || null;
    if (expectedDate !== undefined)
      updateData.expectedDate = expectedDate ? new Date(expectedDate) : null;
    if (notes !== undefined) updateData.notes = notes || null;

    const updated = await prisma.purchaseOrder.update({
      where: { id },
      data: updateData,
      include: {
        lines: {
          orderBy: { sortOrder: "asc" },
          include: {
            material: {
              select: { id: true, code: true, name: true, unit: true },
            },
          },
        },
      },
    });

    return NextResponse.json(JSON.parse(JSON.stringify(updated)));
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    console.error("PATCH /api/procurement/purchase-orders/[id] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/procurement/purchase-orders/[id] — soft cancel purchase order
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    requirePermission(session, ROLES.PLANNING);
    const { id } = await params;
    const tenantId = session!.user.tenantId;

    const existing = await prisma.purchaseOrder.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.purchaseOrder.updateMany({
      where: { id, tenantId },
      data: { status: "CANCELLED" },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    console.error("DELETE /api/procurement/purchase-orders/[id] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
