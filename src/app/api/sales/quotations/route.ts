import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";
import { generateDocNumber, DOC_PREFIX } from "@/lib/doc-numbering";
import { quotationCreateSchema } from "@/lib/validators/quotation";
import { calculateDocumentTotals } from "@/lib/document-tax-propagation";
import {
  applyProductSnapshotsToQuotationLines,
  ProductSnapshotLookupError,
} from "@/lib/quotation-product-snapshots";
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

    // Look up customer only to verify tenant ownership. VAT is selected per document.
    const customer = await prisma.customer.findFirst({
      where: { id: data.customerId, tenantId },
    });

    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    const productIds = [...new Set(data.lines.map((line) => line.productId))];
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, tenantId, isActive: true },
      select: {
        id: true,
        code: true,
        productKind: true,
        drawingSource: true,
        drawingRevision: true,
        customerDrawingUrl: true,
        fusionFileUrl: true,
      },
    });

    let productSnapshots;
    try {
      productSnapshots = applyProductSnapshotsToQuotationLines({
        lines: data.lines,
        products,
      });
    } catch (error) {
      if (error instanceof ProductSnapshotLookupError) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 },
        );
      }
      throw error;
    }

    const totals = calculateDocumentTotals({
      taxType: data.taxType,
      currencyCode: data.currencyCode,
      lines: productSnapshots.lines,
      discountPercent: data.discountPercent,
    });
    const linesWithTotals = productSnapshots.lines.map((line, idx) => ({
      ...line,
      ...totals.lines[idx],
    }));

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
          discountPercent: totals.discountPercent,
          discountAmount: totals.discountAmount,
          subtotal: totals.subtotal,
          vatRate: totals.vatRate,
          vatAmount: totals.vatAmount,
          totalAmount: totals.totalAmount,
          vatModePolicy: totals.vatModePolicy,
          taxType: totals.taxType,
          currencyCode: totals.currencyCode,
          billingNature: productSnapshots.billingNature,
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
              enteredUnitPrice: line.enteredUnitPrice,
              unitPrice: line.unitPrice,
              vatPriceMode: line.vatPriceMode,
              discountPercent: line.discountPercent,
              lineTotal: line.lineTotal,
              notes: line.notes,
              sortOrder: line.sortOrder,
              drawingSource: line.drawingSource ?? "TENANT_OWNED",
              lineBillingNature: line.lineBillingNature ?? null,
              productCode: line.productCode ?? null,
              drawingRevision: line.drawingRevision ?? null,
              customerDrawingUrl: line.customerDrawingUrl ?? null,
              customerBranding: line.customerBranding ?? undefined,
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
