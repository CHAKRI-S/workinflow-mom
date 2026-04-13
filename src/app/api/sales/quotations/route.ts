import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";
import { generateDocNumber, DOC_PREFIX } from "@/lib/doc-numbering";
import { quotationCreateSchema } from "@/lib/validators/quotation";
// GET /api/sales/quotations — list all quotations for tenant
export async function GET() {
  try {
    const session = await auth();
    requirePermission(session, ROLES.SALES_TEAM);

    const quotations = await prisma.quotation.findMany({
      where: { tenantId: session!.user.tenantId },
      orderBy: { createdAt: "desc" },
      include: {
        customer: { select: { id: true, code: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        _count: { select: { lines: true } },
      },
    });

    return NextResponse.json(JSON.parse(JSON.stringify(quotations)));
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/sales/quotations error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/sales/quotations — create new quotation with lines
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    requirePermission(session, ROLES.SALES_TEAM);

    const body = await req.json();
    const data = quotationCreateSchema.parse(body);

    const tenantId = session!.user.tenantId;

    // Look up customer to determine VAT status
    const customer = await prisma.customer.findFirst({
      where: { id: data.customerId, tenantId },
    });

    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    const vatRate = customer.isVatRegistered ? 7 : 0;

    // Calculate line totals
    const linesWithTotals = data.lines.map((line) => {
      const lineSubtotal = line.quantity * line.unitPrice;
      const lineDiscount = lineSubtotal * line.discountPercent / 100;
      const lineTotal = Math.round((lineSubtotal - lineDiscount) * 100) / 100;
      return { ...line, lineTotal };
    });

    // Calculate totals
    const subtotal = linesWithTotals.reduce((sum, l) => sum + l.lineTotal, 0);
    const discountPercent = data.discountPercent;
    const discountAmount = Math.round((subtotal * discountPercent) / 100);
    const afterDiscount = subtotal - discountAmount;
    const vatAmount = Math.round((afterDiscount * vatRate) / 100);
    const totalAmount = Math.round((afterDiscount + vatAmount) * 100) / 100;

    // Create quotation in a transaction
    const quotation = await prisma.$transaction(async (tx) => {
      const quotationNumber = await generateDocNumber(
        tenantId,
        DOC_PREFIX.QUOTATION
      );

      const qt = await tx.quotation.create({
        data: {
          quotationNumber,
          customerId: data.customerId,
          validUntil: new Date(data.validUntil),
          paymentTerms: data.paymentTerms,
          deliveryTerms: data.deliveryTerms,
          leadTimeDays: data.leadTimeDays,
          discountPercent,
          discountAmount,
          subtotal,
          vatRate,
          vatAmount,
          totalAmount,
          notes: data.notes,
          internalNotes: data.internalNotes,
          createdById: session!.user.id,
          tenantId,
          lines: {
            create: linesWithTotals.map((line) => ({
              productId: line.productId,
              description: line.description,
              quantity: line.quantity,
              color: line.color,
              surfaceFinish: line.surfaceFinish,
              materialSpec: line.materialSpec,
              unitPrice: line.unitPrice,
              discountPercent: line.discountPercent,
              lineTotal: line.lineTotal,
              notes: line.notes,
              sortOrder: line.sortOrder,
            })),
          },
        },
        include: {
          customer: { select: { id: true, code: true, name: true } },
          lines: { include: { product: true }, orderBy: { sortOrder: "asc" } },
        },
      });

      return qt;
    });

    return NextResponse.json(JSON.parse(JSON.stringify(quotation)), {
      status: 201,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation failed", details: error },
        { status: 400 }
      );
    }
    console.error("POST /api/sales/quotations error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
