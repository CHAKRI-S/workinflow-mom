import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";
import { generateDocNumber, DOC_PREFIX } from "@/lib/doc-numbering";
import { Prisma } from "@/generated/prisma/client";

type Params = { params: Promise<{ id: string }> };

// POST /api/sales/orders/[id]/convert — convert quotation to sales order
// Here [id] is the quotation ID
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    requirePermission(session, ROLES.SALES_TEAM);
    const { id: quotationId } = await params;
    const tenantId = session!.user.tenantId;

    const body = await req.json().catch(() => ({}));
    const requestedDate = body.requestedDate
      ? new Date(body.requestedDate)
      : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // default 14 days from now
    const depositPercent = body.depositPercent !== undefined
      ? Number(body.depositPercent)
      : 0;

    // Fetch quotation with lines
    const quotation = await prisma.quotation.findFirst({
      where: { id: quotationId, tenantId },
      include: {
        customer: true,
        lines: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    if (!quotation) {
      return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
    }

    if (quotation.status !== "APPROVED") {
      return NextResponse.json(
        { error: "Only APPROVED quotations can be converted" },
        { status: 400 }
      );
    }

    // Map quotation lines to SO lines. Tax/currency totals are copied from the approved quotation.
    // Quotation tax type is the source of truth, not customer VAT registration.

    // Map quotation lines to SO lines
    const soLines = quotation.lines.map((line, idx) => ({
      productId: line.productId,
      description: line.description,
      quantity: line.quantity,
      color: line.color,
      surfaceFinish: line.surfaceFinish,
      materialSpec: line.materialSpec,
      enteredUnitPrice: line.enteredUnitPrice ?? line.unitPrice,
      unitPrice: line.unitPrice,
      vatPriceMode: line.vatPriceMode,
      discountPercent: line.discountPercent,
      lineTotal: line.lineTotal,
      notes: line.notes,
      sortOrder: line.sortOrder ?? idx,
      drawingSource: line.drawingSource,
      lineBillingNature: line.lineBillingNature,
      productCode: line.productCode,
      drawingRevision: line.drawingRevision,
      customerDrawingUrl: line.customerDrawingUrl,
      customerBranding:
        (line.customerBranding ?? undefined) as Prisma.InputJsonValue | undefined,
    }));

    const subtotal = Number(quotation.subtotal);
    const discountPercent = Number(quotation.discountPercent);
    const discountAmount = Number(quotation.discountAmount);
    const vatRate = Number(quotation.vatRate);
    const vatAmount = Number(quotation.vatAmount);
    const totalAmount = Number(quotation.totalAmount);
    const depositAmount = Math.round((totalAmount * depositPercent) / 100);

    const order = await prisma.$transaction(async (tx) => {
      const orderNumber = await generateDocNumber(tenantId, DOC_PREFIX.SALES_ORDER);

      const created = await tx.salesOrder.create({
        data: {
          orderNumber,
          tenantId,
          customerId: quotation.customerId,
          quotationId: quotation.id,
          customerPoNumber: body.customerPoNumber || null,
          requestedDate,
          promisedDate: body.promisedDate ? new Date(body.promisedDate) : null,
          shippingAddress: quotation.customer.shippingAddress || null,
          depositPercent,
          depositAmount,
          subtotal,
          discountPercent,
          discountAmount,
          vatRate,
          vatAmount,
          totalAmount,
          vatModePolicy: quotation.vatModePolicy,
          taxType: quotation.taxType,
          currencyCode: quotation.currencyCode,
          paymentTerms: quotation.paymentTerms || null,
          billingNature: quotation.billingNature,
          notes: quotation.notes || null,
          createdById: session!.user.id,
          status: "CONFIRMED",
          paymentStatus: "UNPAID",
          lines: {
            create: soLines,
          },
        },
        include: {
          customer: { select: { id: true, code: true, name: true } },
          lines: true,
        },
      });

      // Mark quotation as converted (optional: update quotation status)
      await tx.quotation.updateMany({
        where: { id: quotationId, tenantId },
        data: { status: "APPROVED" }, // keep as APPROVED
      });

      return created;
    });

    return NextResponse.json(JSON.parse(JSON.stringify(order)), { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    console.error("POST /api/sales/orders/[id]/convert error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
