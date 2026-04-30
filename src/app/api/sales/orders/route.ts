import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";
import { salesOrderCreateSchema } from "@/lib/validators/sales-order";
import { generateDocNumber, DOC_PREFIX } from "@/lib/doc-numbering";
import { Prisma } from "@/generated/prisma/client";
import { calculateVatTotals } from "@/lib/vat";

// GET /api/sales/orders — list all sales orders for tenant
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    requirePermission(session, ROLES.SALES_TEAM);

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const where: Prisma.SalesOrderWhereInput = {
      tenantId: session!.user.tenantId,
    };

    if (status && status !== "ALL") {
      where.status = status as Prisma.SalesOrderWhereInput["status"];
    }

    const orders = await prisma.salesOrder.findMany({
      where,
      orderBy: { orderDate: "desc" },
      include: {
        customer: { select: { id: true, code: true, name: true } },
        _count: { select: { lines: true } },
      },
    });

    return NextResponse.json(JSON.parse(JSON.stringify(orders)));
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    console.error("GET /api/sales/orders error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/sales/orders — create new sales order
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    requirePermission(session, ROLES.SALES_TEAM);

    const body = await req.json();
    const data = salesOrderCreateSchema.parse(body);
    const tenantId = session!.user.tenantId;

    // Fetch customer to determine VAT status
    const customer = await prisma.customer.findFirst({
      where: { id: data.customerId, tenantId },
    });

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const vatRate = customer.isVatRegistered ? 7 : 0;

    const totals = calculateVatTotals(data.lines, {
      vatRate,
      vatModePolicy: data.vatModePolicy,
    });

    // Calculate line totals
    const linesWithTotals = data.lines.map((line, idx) => {
      const calculated = totals.lines[idx];
      const qty = Number(line.quantity);
      const discPct = Number(line.discountPercent);

      return {
        productId: line.productId,
        description: line.description || null,
        quantity: qty,
        color: line.color || null,
        surfaceFinish: line.surfaceFinish || null,
        materialSpec: line.materialSpec || null,
        enteredUnitPrice: calculated.enteredUnitPrice,
        unitPrice: calculated.unitPrice,
        vatPriceMode: calculated.vatPriceMode,
        discountPercent: discPct,
        lineTotal: calculated.lineTotal,
        notes: line.notes || null,
        sortOrder: line.sortOrder ?? idx,
        drawingSource: line.drawingSource ?? "TENANT_OWNED",
        lineBillingNature: line.lineBillingNature ?? null,
        productCode: line.productCode ?? null,
        drawingRevision: line.drawingRevision ?? null,
        customerDrawingUrl: line.customerDrawingUrl ?? null,
        customerBranding: line.customerBranding ?? undefined,
      };
    });

    const depositPercent = Number(data.depositPercent);
    const depositAmount = Math.round((totals.totalAmount * depositPercent) / 100);

    // Create within transaction
    const order = await prisma.$transaction(async (tx) => {
      const orderNumber = await generateDocNumber(tenantId, DOC_PREFIX.SALES_ORDER);

      const created = await tx.salesOrder.create({
        data: {
          orderNumber,
          tenantId,
          customerId: data.customerId,
          quotationId: data.quotationId || null,
          customerPoNumber: data.customerPoNumber || null,
          requestedDate: new Date(data.requestedDate),
          promisedDate: data.promisedDate ? new Date(data.promisedDate) : null,
          shippingAddress: data.shippingAddress || null,
          depositPercent,
          depositAmount,
          subtotal: totals.subtotal,
          discountPercent: totals.discountPercent,
          discountAmount: totals.discountAmount,
          vatRate,
          vatAmount: totals.vatAmount,
          totalAmount: totals.totalAmount,
          vatModePolicy: data.vatModePolicy ?? "PER_LINE",
          paymentTerms: data.paymentTerms || null,
          billingNature: data.billingNature ?? "GOODS",
          notes: data.notes || null,
          internalNotes: data.internalNotes || null,
          createdById: session!.user.id,
          status: "CONFIRMED",
          paymentStatus: "UNPAID",
          lines: {
            create: linesWithTotals,
          },
        },
        include: {
          customer: { select: { id: true, code: true, name: true } },
          lines: true,
        },
      });

      return created;
    });

    return NextResponse.json(JSON.parse(JSON.stringify(order)), { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    if (err instanceof Error && err.name === "ZodError") {
      return NextResponse.json({ error: "Validation failed", details: err }, { status: 400 });
    }
    console.error("POST /api/sales/orders error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
