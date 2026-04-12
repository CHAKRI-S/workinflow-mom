import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";
import { generateDocNumber, DOC_PREFIX } from "@/lib/doc-numbering";
import { Prisma, POLineType } from "@/generated/prisma/client";

// GET /api/procurement/purchase-orders — list all POs for tenant
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    requirePermission(session, ROLES.PLANNING);

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const where: Prisma.PurchaseOrderWhereInput = {
      tenantId: session!.user.tenantId,
    };

    if (status && status !== "ALL") {
      where.status = status as Prisma.PurchaseOrderWhereInput["status"];
    }

    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { lines: true } },
      },
    });

    return NextResponse.json(JSON.parse(JSON.stringify(purchaseOrders)));
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    console.error("GET /api/procurement/purchase-orders error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/procurement/purchase-orders — create new PO with lines
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    requirePermission(session, ROLES.PLANNING);

    const body = await req.json();
    const { supplierName, supplierContact, expectedDate, notes, lines } = body;

    if (!supplierName || !lines || !Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json(
        { error: "supplierName and at least one line are required" },
        { status: 400 }
      );
    }

    const tenantId = session!.user.tenantId;

    // Calculate line totals
    const linesWithTotals = lines.map(
      (
        line: {
          lineType?: string;
          materialId?: string;
          consumableId?: string;
          description: string;
          quantity: number;
          unit?: string;
          unitCost: number;
          notes?: string;
        },
        idx: number
      ) => {
        const qty = Number(line.quantity);
        const cost = Number(line.unitCost);
        const lineTotal = Math.round(qty * cost * 100) / 100;

        return {
          lineType: (line.lineType || "OTHER") as POLineType,
          materialId: line.materialId || null,
          consumableId: line.consumableId || null,
          description: line.description,
          quantity: qty,
          unit: line.unit || "PCS",
          unitCost: cost,
          lineTotal,
          receivedQty: 0,
          notes: line.notes || null,
          sortOrder: idx,
        };
      }
    );

    const totalAmount = linesWithTotals.reduce(
      (sum: number, l: { lineTotal: number }) => sum + l.lineTotal,
      0
    );

    // Create within transaction
    const purchaseOrder = await prisma.$transaction(async (tx) => {
      const poNumber = await generateDocNumber(
        tenantId,
        DOC_PREFIX.PURCHASE_ORDER
      );

      const created = await tx.purchaseOrder.create({
        data: {
          poNumber,
          tenantId,
          supplierName,
          supplierContact: supplierContact || null,
          expectedDate: expectedDate ? new Date(expectedDate) : null,
          notes: notes || null,
          totalAmount,
          status: "DRAFT",
          lines: {
            create: linesWithTotals,
          },
        },
        include: {
          lines: {
            orderBy: { sortOrder: "asc" },
          },
        },
      });

      // Auto-update Consumable lastPrice, lastSupplier, lastPurchaseDate
      const consumableLines = linesWithTotals.filter(
        (l) => l.lineType === "CONSUMABLE" && l.consumableId
      );

      for (const cl of consumableLines) {
        await tx.consumable.updateMany({
          where: { id: cl.consumableId!, tenantId },
          data: {
            lastPrice: cl.unitCost,
            lastSupplier: supplierName,
            lastPurchaseDate: new Date(),
          },
        });
      }

      return created;
    });

    return NextResponse.json(JSON.parse(JSON.stringify(purchaseOrder)), {
      status: 201,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    console.error("POST /api/procurement/purchase-orders error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
