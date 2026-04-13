import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";
import { salesOrderCreateSchema } from "@/lib/validators/sales-order";
import { generateDocNumber, DOC_PREFIX } from "@/lib/doc-numbering";
import { Prisma } from "@/generated/prisma/client";

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

    // Calculate line totals
    const linesWithTotals = data.lines.map((line, idx) => {
      const qty = Number(line.quantity);
      const price = Number(line.unitPrice);
      const discPct = Number(line.discountPercent);
      const lineSubtotal = qty * price;
      const lineDiscount = Math.round((lineSubtotal * discPct) / 100);
      const lineTotal = Math.round((lineSubtotal - lineDiscount) * 100) / 100;

      return {
        productId: line.productId,
        description: line.description || null,
        quantity: qty,
        color: line.color || null,
        surfaceFinish: line.surfaceFinish || null,
        materialSpec: line.materialSpec || null,
        unitPrice: price,
        discountPercent: discPct,
        lineTotal,
        notes: line.notes || null,
        sortOrder: line.sortOrder ?? idx,
      };
    });

    // Calculate order totals
    const subtotal = linesWithTotals.reduce(
      (sum, l) => sum + l.lineTotal,
      0
    );

    const discountPercent = 0;
    const discountAmount = Math.round((subtotal * discountPercent) / 100);
    const afterDiscount = Math.round((subtotal - discountAmount) * 100) / 100;
    const vatAmount = Math.round((afterDiscount * vatRate) / 100);
    const totalAmount = Math.round((afterDiscount + vatAmount) * 100) / 100;

    const depositPercent = Number(data.depositPercent);
    const depositAmount = Math.round((totalAmount * depositPercent) / 100);

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
          subtotal,
          discountPercent,
          discountAmount,
          vatRate,
          vatAmount,
          totalAmount,
          paymentTerms: data.paymentTerms || null,
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
