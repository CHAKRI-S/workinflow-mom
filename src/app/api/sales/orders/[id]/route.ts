import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";
import { salesOrderUpdateSchema } from "@/lib/validators/sales-order";
import { Prisma } from "@/generated/prisma/client";

type Params = { params: Promise<{ id: string }> };

// GET /api/sales/orders/[id] — get order detail
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    requirePermission(session, ROLES.SALES_TEAM);
    const { id } = await params;

    const order = await prisma.salesOrder.findFirst({
      where: { id, tenantId: session!.user.tenantId },
      include: {
        customer: {
          select: {
            id: true,
            code: true,
            name: true,
            isVatRegistered: true,
            shippingAddress: true,
            paymentTermDays: true,
          },
        },
        quotation: {
          select: { id: true, quotationNumber: true },
        },
        lines: {
          orderBy: { sortOrder: "asc" },
          include: {
            product: {
              select: { id: true, code: true, name: true },
            },
          },
        },
        createdBy: {
          select: { id: true, name: true },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(JSON.parse(JSON.stringify(order)));
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    console.error("GET /api/sales/orders/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/sales/orders/[id] — update order (only if CONFIRMED)
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    requirePermission(session, ROLES.SALES_TEAM);
    const { id } = await params;
    const tenantId = session!.user.tenantId;

    // Check current status
    const existing = await prisma.salesOrder.findFirst({
      where: { id, tenantId },
      include: { customer: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (existing.status !== "CONFIRMED") {
      return NextResponse.json(
        { error: "Can only edit orders in CONFIRMED status" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const data = salesOrderUpdateSchema.parse(body);

    // If customer changed, look up new customer for VAT
    let customer = existing.customer;
    if (data.customerId && data.customerId !== existing.customerId) {
      const newCustomer = await prisma.customer.findFirst({
        where: { id: data.customerId, tenantId },
      });
      if (!newCustomer) {
        return NextResponse.json({ error: "Customer not found" }, { status: 404 });
      }
      customer = newCustomer;
    }

    const vatRate = customer.isVatRegistered ? 7 : 0;

    const order = await prisma.$transaction(async (tx) => {
      // If lines are provided, recalculate
      if (data.lines && data.lines.length > 0) {
        // Delete old lines
        await tx.salesOrderLine.deleteMany({
          where: { salesOrderId: id },
        });

        const linesWithTotals = data.lines.map((line, idx) => {
          const qty = Number(line.quantity);
          const price = Number(line.unitPrice);
          const discPct = Number(line.discountPercent);
          const lineSubtotal = qty * price;
          const lineDiscount = Math.round(lineSubtotal * discPct) / 100;
          const lineTotal = Math.round((lineSubtotal - lineDiscount) * 100) / 100;

          return {
            salesOrderId: id,
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

        await tx.salesOrderLine.createMany({ data: linesWithTotals });

        // Recalculate totals
        const subtotal = linesWithTotals.reduce(
          (sum, l) => sum + l.lineTotal,
          0
        );

        const discountPercent = 0;
        const discountAmount = Math.round(subtotal * discountPercent) / 100;
        const afterDiscount = Math.round((subtotal - discountAmount) * 100) / 100;
        const vatAmount = Math.round(afterDiscount * vatRate) / 100;
        const totalAmount = Math.round((afterDiscount + vatAmount) * 100) / 100;

        const depositPercent = data.depositPercent !== undefined
          ? Number(data.depositPercent)
          : Number(existing.depositPercent);
        const depositAmount = Math.round(totalAmount * depositPercent) / 100;

        const updated = await tx.salesOrder.update({
          where: { id },
          data: {
            customerId: data.customerId ?? existing.customerId,
            quotationId: data.quotationId ?? existing.quotationId,
            customerPoNumber: data.customerPoNumber ?? existing.customerPoNumber,
            requestedDate: data.requestedDate ? new Date(data.requestedDate) : existing.requestedDate,
            promisedDate: data.promisedDate ? new Date(data.promisedDate) : existing.promisedDate,
            shippingAddress: data.shippingAddress ?? existing.shippingAddress,
            depositPercent,
            depositAmount,
            subtotal,
            discountPercent,
            discountAmount,
            vatRate,
            vatAmount,
            totalAmount,
            paymentTerms: data.paymentTerms ?? existing.paymentTerms,
            notes: data.notes ?? existing.notes,
            internalNotes: data.internalNotes ?? existing.internalNotes,
          },
          include: {
            customer: { select: { id: true, code: true, name: true } },
            lines: {
              orderBy: { sortOrder: "asc" },
              include: {
                product: { select: { id: true, code: true, name: true } },
              },
            },
          },
        });

        return updated;
      }

      // No line changes — update header only
      const updateData: Prisma.SalesOrderUpdateInput = {};
      if (data.customerId) updateData.customer = { connect: { id: data.customerId } };
      if (data.customerPoNumber !== undefined) updateData.customerPoNumber = data.customerPoNumber || null;
      if (data.requestedDate) updateData.requestedDate = new Date(data.requestedDate);
      if (data.promisedDate !== undefined) updateData.promisedDate = data.promisedDate ? new Date(data.promisedDate) : null;
      if (data.shippingAddress !== undefined) updateData.shippingAddress = data.shippingAddress || null;
      if (data.paymentTerms !== undefined) updateData.paymentTerms = data.paymentTerms || null;
      if (data.notes !== undefined) updateData.notes = data.notes || null;
      if (data.internalNotes !== undefined) updateData.internalNotes = data.internalNotes || null;

      if (data.depositPercent !== undefined) {
        const dp = Number(data.depositPercent);
        updateData.depositPercent = dp;
        updateData.depositAmount = Math.round(Number(existing.totalAmount) * dp) / 100;
      }

      updateData.vatRate = vatRate;

      const updated = await tx.salesOrder.update({
        where: { id },
        data: updateData,
        include: {
          customer: { select: { id: true, code: true, name: true } },
          lines: {
            orderBy: { sortOrder: "asc" },
            include: {
              product: { select: { id: true, code: true, name: true } },
            },
          },
        },
      });

      return updated;
    });

    return NextResponse.json(JSON.parse(JSON.stringify(order)));
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    if (err instanceof Error && err.name === "ZodError") {
      return NextResponse.json({ error: "Validation failed", details: err }, { status: 400 });
    }
    console.error("PATCH /api/sales/orders/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/sales/orders/[id] — soft cancel order
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    requirePermission(session, ROLES.SALES_TEAM);
    const { id } = await params;
    const tenantId = session!.user.tenantId;

    const existing = await prisma.salesOrder.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.salesOrder.updateMany({
      where: { id, tenantId },
      data: { status: "CANCELLED" },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    console.error("DELETE /api/sales/orders/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
