import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";
import { generateDocNumber, invoicePrefix } from "@/lib/doc-numbering";
import { Prisma } from "@/generated/prisma/client";

// GET /api/finance/invoices — list all invoices for tenant
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    requirePermission(session, ROLES.FINANCE);

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const where: Prisma.InvoiceWhereInput = {
      tenantId: session!.user.tenantId,
    };

    if (status && status !== "ALL") {
      where.status = status as Prisma.InvoiceWhereInput["status"];
    }

    const invoices = await prisma.invoice.findMany({
      where,
      orderBy: { issueDate: "desc" },
      include: {
        customer: { select: { id: true, code: true, name: true } },
        salesOrder: { select: { id: true, orderNumber: true } },
      },
    });

    return NextResponse.json(JSON.parse(JSON.stringify(invoices)));
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    console.error("GET /api/finance/invoices error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/finance/invoices — create new invoice
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    requirePermission(session, ROLES.FINANCE);

    const body = await req.json();
    const {
      salesOrderId,
      invoiceType,
      dueDate,
      lines,
      notes,
    } = body;

    if (!salesOrderId || !invoiceType || !dueDate || !lines?.length) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const tenantId = session!.user.tenantId;

    // Fetch sales order with customer
    const salesOrder = await prisma.salesOrder.findFirst({
      where: { id: salesOrderId, tenantId },
      include: {
        customer: { select: { id: true, isVatRegistered: true } },
      },
    });

    if (!salesOrder) {
      return NextResponse.json(
        { error: "Sales order not found" },
        { status: 404 }
      );
    }

    const customer = salesOrder.customer;
    const vatRate = customer.isVatRegistered ? 7 : 0;

    // Calculate line totals
    const linesWithTotals = lines.map(
      (
        line: {
          salesOrderLineId?: string;
          description: string;
          quantity: number;
          unitPrice: number;
          notes?: string;
          sortOrder?: number;
        },
        idx: number
      ) => {
        const qty = Number(line.quantity);
        const price = Number(line.unitPrice);
        const lineTotal = Math.round(qty * price * 100) / 100;

        return {
          salesOrderLineId: line.salesOrderLineId || null,
          description: line.description,
          quantity: qty,
          unitPrice: price,
          lineTotal,
          notes: line.notes || null,
          sortOrder: line.sortOrder ?? idx,
        };
      }
    );

    // Calculate totals
    const subtotal = linesWithTotals.reduce(
      (sum: number, l: { lineTotal: number }) => sum + l.lineTotal,
      0
    );
    const discountAmount = 0;
    const afterDiscount = subtotal - discountAmount;
    const vatAmount = Math.round(afterDiscount * vatRate) / 100;
    const totalAmount = Math.round((afterDiscount + vatAmount) * 100) / 100;

    const invoice = await prisma.$transaction(async (tx) => {
      const prefix = invoicePrefix(customer.isVatRegistered);
      const invoiceNumber = await generateDocNumber(tenantId, prefix);

      const created = await tx.invoice.create({
        data: {
          invoiceNumber,
          invoiceType,
          salesOrderId,
          customerId: customer.id,
          status: "DRAFT",
          issueDate: new Date(),
          dueDate: new Date(dueDate),
          subtotal,
          discountAmount,
          vatRate,
          vatAmount,
          totalAmount,
          paidAmount: 0,
          notes: notes || null,
          createdById: session!.user.id,
          tenantId,
          lines: {
            create: linesWithTotals,
          },
        },
        include: {
          customer: { select: { id: true, code: true, name: true } },
          salesOrder: { select: { id: true, orderNumber: true } },
          lines: true,
        },
      });

      return created;
    });

    return NextResponse.json(JSON.parse(JSON.stringify(invoice)), {
      status: 201,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    console.error("POST /api/finance/invoices error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
