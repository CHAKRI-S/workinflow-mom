import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";
import { quotationUpdateSchema } from "@/lib/validators/quotation";

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

    // If customerId changed, lookup new customer for VAT
    let vatRate = Number(existing.vatRate);
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
      vatRate = customer.isVatRegistered ? 7 : 0;
    }

    // Recalculate if lines are provided
    let calculatedFields = {};
    if (data.lines && data.lines.length > 0) {
      const linesWithTotals = data.lines.map((line) => {
        const lineSubtotal = line.quantity * line.unitPrice;
        const lineDiscount = lineSubtotal * line.discountPercent / 100;
        const lineTotal = Math.round((lineSubtotal - lineDiscount) * 100) / 100;
        return { ...line, lineTotal };
      });

      const subtotal = linesWithTotals.reduce((sum, l) => sum + l.lineTotal, 0);
      const discountPercent = data.discountPercent ?? 0;
      const discountAmount = Math.round((subtotal * discountPercent) / 100);
      const afterDiscount = subtotal - discountAmount;
      const vatAmount = Math.round((afterDiscount * vatRate) / 100);
      const totalAmount = Math.round((afterDiscount + vatAmount) * 100) / 100;

      calculatedFields = {
        subtotal,
        discountPercent,
        discountAmount,
        vatRate,
        vatAmount,
        totalAmount,
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
                unitPrice: line.unitPrice,
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
        billingNature: data.billingNature,
        notes: data.notes,
        internalNotes: data.internalNotes,
        vatRate,
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
