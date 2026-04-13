import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";
import { generateDocNumber, receiptPrefix } from "@/lib/doc-numbering";
import { Prisma } from "@/generated/prisma/client";

// GET /api/finance/receipts — list all receipts for tenant
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    requirePermission(session, ROLES.FINANCE);

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const where: Prisma.ReceiptWhereInput = {
      tenantId: session!.user.tenantId,
    };

    if (status && status !== "ALL") {
      where.status = status as Prisma.ReceiptWhereInput["status"];
    }

    const receipts = await prisma.receipt.findMany({
      where,
      orderBy: { issueDate: "desc" },
      include: {
        invoice: { select: { id: true, invoiceNumber: true } },
      },
    });

    return NextResponse.json(JSON.parse(JSON.stringify(receipts)));
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    console.error("GET /api/finance/receipts error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/finance/receipts — create new receipt
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    requirePermission(session, ROLES.FINANCE);

    const body = await req.json();
    const { invoiceId, amount, payerName, payerTaxId, payerAddress, notes } =
      body;

    if (!invoiceId || !amount || !payerName) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const tenantId = session!.user.tenantId;

    // Fetch invoice with customer VAT status
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId },
      include: {
        salesOrder: {
          include: {
            customer: { select: { isVatRegistered: true } },
          },
        },
      },
    });

    if (!invoice || !invoice.salesOrder || !invoice.salesOrder.customer) {
      return NextResponse.json(
        { error: "Invoice, sales order, or customer not found" },
        { status: 404 }
      );
    }

    const isVat = invoice.salesOrder.customer.isVatRegistered;

    const receipt = await prisma.$transaction(async (tx) => {
      const prefix = receiptPrefix(isVat);
      const receiptNumber = await generateDocNumber(tenantId, prefix);

      const created = await tx.receipt.create({
        data: {
          receiptNumber,
          invoiceId,
          status: "DRAFT",
          issueDate: new Date(),
          amount: Number(amount),
          payerName,
          payerTaxId: payerTaxId || null,
          payerAddress: payerAddress || null,
          notes: notes || null,
          createdById: session!.user.id,
          tenantId,
        },
        include: {
          invoice: { select: { id: true, invoiceNumber: true } },
        },
      });

      return created;
    });

    return NextResponse.json(JSON.parse(JSON.stringify(receipt)), {
      status: 201,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    console.error("POST /api/finance/receipts error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
