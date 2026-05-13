import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";
import { quotationUpdateSchema } from "@/lib/validators/quotation";
import { calculateDocumentTotals, inheritDocumentTaxAndCurrency } from "@/lib/document-tax-propagation";
import { Prisma, type VatModePolicy } from "@/generated/prisma/client";

type Params = { params: Promise<{ id: string }> };

// GET /api/sales/quotations/[id] — get quotation detail with lines
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    requirePermission(session, ROLES.SALES_TEAM);
    const { id } = await params;

    const quotation = await prisma.quotation.findFirst({
      where: { id, tenantId: session!.user.tenantId },
      include: {
        customer: {
          select: {
            id: true,
            code: true,
            name: true,
            isVatRegistered: true,
            contactName: true,
            phone: true,
            email: true,
          },
        },
        createdBy: { select: { id: true, name: true } },
        lines: {
          include: {
            product: {
              select: { id: true, code: true, name: true },
            },
          },
          orderBy: { sortOrder: "asc" },
        },
        _count: { select: { salesOrders: true } },
      },
    });

    if (!quotation) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(JSON.parse(JSON.stringify(quotation)));
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/sales/quotations/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH /api/sales/quotations/[id] — update quotation (DRAFT or REVISED only)
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    requirePermission(session, ROLES.SALES_TEAM);
    const { id } = await params;
    const tenantId = session!.user.tenantId;

    // Check existing quotation
    const existing = await prisma.quotation.findFirst({
      where: { id, tenantId },
      include: { lines: { orderBy: { sortOrder: "asc" } } },
    });

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (existing.status !== "DRAFT" && existing.status !== "REVISED") {
      return NextResponse.json(
        { error: "Can only edit quotations in DRAFT or REVISED status" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const data = quotationUpdateSchema.parse(body);

    // If customerId changed, lookup new customer for tenant ownership only.
    if (data.customerId && data.customerId !== existing.customerId) {
      const customer = await prisma.customer.findFirst({
        where: { id: data.customerId, tenantId },
      });
      if (!customer) {
        return NextResponse.json(
          { error: "Customer not found" },
          { status: 404 }
        );
      }
    }

    const inherited = inheritDocumentTaxAndCurrency({
      source: existing,
      override: data,
    });
    const recalculationLines = data.lines ?? existing.lines.map((line) => ({
      productId: line.productId,
      description: line.description ?? undefined,
      quantity: Number(line.quantity),
      color: line.color ?? undefined,
      surfaceFinish: line.surfaceFinish ?? undefined,
      materialSpec: line.materialSpec ?? undefined,
      enteredUnitPrice: Number(line.enteredUnitPrice ?? line.unitPrice),
      unitPrice: Number(line.enteredUnitPrice ?? line.unitPrice),
      vatPriceMode: line.vatPriceMode,
      discountPercent: Number(line.discountPercent),
      notes: line.notes ?? undefined,
      sortOrder: line.sortOrder,
      drawingSource: line.drawingSource,
      lineBillingNature: line.lineBillingNature,
      productCode: line.productCode,
      drawingRevision: line.drawingRevision,
      customerDrawingUrl: line.customerDrawingUrl,
      customerBranding: line.customerBranding as Record<string, unknown> | null | undefined,
    }));
    const shouldRecalculate =
      Boolean(data.lines?.length) ||
      data.taxType !== undefined ||
      data.currencyCode !== undefined ||
      data.discountPercent !== undefined;

    // Recalculate if lines or document tax/currency fields are provided
    let calculatedFields: Prisma.QuotationUncheckedUpdateInput = {};
    if (shouldRecalculate) {
      const totals = calculateDocumentTotals({
        taxType: inherited.taxType,
        currencyCode: inherited.currencyCode,
        lines: recalculationLines,
        discountPercent: data.discountPercent ?? Number(existing.discountPercent),
      });
      const linesWithTotals = recalculationLines.map((line, idx) => ({
        ...line,
        ...totals.lines[idx],
      }));

      calculatedFields = {
        subtotal: totals.subtotal,
        discountPercent: totals.discountPercent,
        discountAmount: totals.discountAmount,
        vatRate: totals.vatRate,
        vatAmount: totals.vatAmount,
        totalAmount: totals.totalAmount,
        vatModePolicy: totals.vatModePolicy,
        taxType: totals.taxType,
        currencyCode: totals.currencyCode,
      };

      // Update in transaction: delete old lines, create new
      const quotation = await prisma.$transaction(async (tx) => {
        // Delete existing lines
        await tx.quotationLine.deleteMany({ where: { quotationId: id } });

        // Update quotation and create new lines
        const updated = await tx.quotation.update({
          where: { id },
          data: {
            customerId: data.customerId,
            validUntil: data.validUntil ? new Date(data.validUntil) : undefined,
            paymentTerms: data.paymentTerms,
            deliveryTerms: data.deliveryTerms,
            leadTimeDays: data.leadTimeDays,
            vatModePolicy: calculatedFields.vatModePolicy as VatModePolicy | undefined,
            taxType: inherited.taxType,
            currencyCode: inherited.currencyCode,
            billingNature: data.billingNature,
            notes: data.notes,
            internalNotes: data.internalNotes,
            ...calculatedFields,
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
              })) as Prisma.QuotationLineUncheckedCreateWithoutQuotationInput[],
            },
          },
          include: {
            customer: { select: { id: true, code: true, name: true } },
            lines: {
              include: { product: true },
              orderBy: { sortOrder: "asc" },
            },
          },
        });

        return updated;
      });

      return NextResponse.json(JSON.parse(JSON.stringify(quotation)));
    }

    // Update without lines
    const quotation = await prisma.quotation.update({
      where: { id },
      data: {
        customerId: data.customerId,
        validUntil: data.validUntil,
        paymentTerms: data.paymentTerms,
        deliveryTerms: data.deliveryTerms,
        leadTimeDays: data.leadTimeDays,
        vatModePolicy: calculatedFields.vatModePolicy as VatModePolicy | undefined,
        taxType: inherited.taxType,
        currencyCode: inherited.currencyCode,
        billingNature: data.billingNature,
        notes: data.notes,
        internalNotes: data.internalNotes,
        ...calculatedFields,
      },
      include: {
        customer: { select: { id: true, code: true, name: true } },
        lines: {
          include: { product: true },
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    return NextResponse.json(JSON.parse(JSON.stringify(quotation)));
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
    console.error("PATCH /api/sales/quotations/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/sales/quotations/[id] — soft cancel
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    requirePermission(session, ROLES.SALES_TEAM);
    const { id } = await params;

    const existing = await prisma.quotation.findFirst({
      where: { id, tenantId: session!.user.tenantId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.quotation.update({
      where: { id },
      data: { status: "CANCELLED" },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("DELETE /api/sales/quotations/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
