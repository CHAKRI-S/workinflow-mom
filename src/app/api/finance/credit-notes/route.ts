import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";
import { generateDocNumber, creditNotePrefix } from "@/lib/doc-numbering";
import { Prisma } from "@/generated/prisma/client";

// GET /api/finance/credit-notes — list all credit notes for tenant
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    requirePermission(session, ROLES.FINANCE);

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const where: Prisma.CreditNoteWhereInput = {
      tenantId: session!.user.tenantId,
    };

    if (status && status !== "ALL") {
      where.status = status as Prisma.CreditNoteWhereInput["status"];
    }

    const creditNotes = await prisma.creditNote.findMany({
      where,
      orderBy: { issueDate: "desc" },
      include: {
        invoice: { select: { id: true, invoiceNumber: true } },
      },
    });

    return NextResponse.json(JSON.parse(JSON.stringify(creditNotes)));
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    console.error("GET /api/finance/credit-notes error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/finance/credit-notes — create new credit note
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    requirePermission(session, ROLES.FINANCE);

    const body = await req.json();
    const { invoiceId, reason, description, lines, notes } = body;

    if (!invoiceId || !reason || !description || !lines?.length) {
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
    const vatRate = isVat ? 7 : 0;

    // Calculate line totals
    const linesWithTotals = lines.map(
      (
        line: {
          description: string;
          quantity: number;
          unitPrice: number;
          sortOrder?: number;
        },
        idx: number
      ) => {
        const qty = Number(line.quantity);
        const price = Number(line.unitPrice);
        const lineTotal = Math.round(qty * price * 100) / 100;

        return {
          description: line.description,
          quantity: qty,
          unitPrice: price,
          lineTotal,
          sortOrder: line.sortOrder ?? idx,
        };
      }
    );

    const subtotal = linesWithTotals.reduce(
      (sum: number, l: { lineTotal: number }) => sum + l.lineTotal,
      0
    );
    const vatAmount = Math.round((subtotal * vatRate) / 100);
    const totalAmount = Math.round((subtotal + vatAmount) * 100) / 100;

    const creditNote = await prisma.$transaction(async (tx) => {
      const prefix = creditNotePrefix(isVat);
      const creditNoteNumber = await generateDocNumber(tenantId, prefix);

      const created = await tx.creditNote.create({
        data: {
          creditNoteNumber,
          invoiceId,
          status: "DRAFT",
          reason,
          issueDate: new Date(),
          subtotal,
          vatRate,
          vatAmount,
          totalAmount,
          description,
          notes: notes || null,
          tenantId,
          lines: {
            create: linesWithTotals,
          },
        },
        include: {
          invoice: { select: { id: true, invoiceNumber: true } },
          lines: true,
        },
      });

      return created;
    });

    return NextResponse.json(JSON.parse(JSON.stringify(creditNote)), {
      status: 201,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    console.error("POST /api/finance/credit-notes error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
