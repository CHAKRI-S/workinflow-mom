import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";
import { generateDocNumber, DOC_PREFIX } from "@/lib/doc-numbering";
import { createAuditLog } from "@/lib/audit";
import { Prisma } from "@/generated/prisma/client";

// GET /api/finance/tax-invoices — list all tax invoices for tenant
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    requirePermission(session, ROLES.FINANCE);

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const where: Prisma.TaxInvoiceWhereInput = {
      tenantId: session!.user.tenantId,
    };

    if (status && status !== "ALL") {
      where.status = status as Prisma.TaxInvoiceWhereInput["status"];
    }

    const taxInvoices = await prisma.taxInvoice.findMany({
      where,
      orderBy: { issueDate: "desc" },
      include: {
        invoice: { select: { id: true, invoiceNumber: true } },
      },
    });

    return NextResponse.json(JSON.parse(JSON.stringify(taxInvoices)));
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    console.error("GET /api/finance/tax-invoices error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/finance/tax-invoices — create new tax invoice
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    requirePermission(session, ROLES.FINANCE);

    const body = await req.json();
    const { invoiceId, notes } = body;

    if (!invoiceId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const tenantId = session!.user.tenantId;

    // Fetch invoice with customer and tenant info
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId },
      include: {
        customer: {
          select: {
            name: true,
            taxId: true,
            billingAddress: true,
          },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      );
    }

    // Fetch tenant for seller info
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        name: true,
        taxId: true,
        address: true,
      },
    });

    if (!tenant) {
      return NextResponse.json(
        { error: "Tenant not found" },
        { status: 404 }
      );
    }

    const taxInvoice = await prisma.$transaction(async (tx) => {
      const taxInvoiceNumber = await generateDocNumber(
        tenantId,
        DOC_PREFIX.TAX_INVOICE
      );

      const created = await tx.taxInvoice.create({
        data: {
          taxInvoiceNumber,
          invoiceId,
          status: "DRAFT",
          issueDate: new Date(),
          // Buyer info (snapshot from customer)
          buyerName: invoice.customer.name,
          buyerTaxId: invoice.customer.taxId || null,
          buyerAddress: invoice.customer.billingAddress || null,
          buyerBranch: null,
          // Seller info (snapshot from tenant)
          sellerName: tenant.name,
          sellerTaxId: tenant.taxId || null,
          sellerAddress: tenant.address || null,
          // Amounts from invoice
          subtotal: Number(invoice.subtotal),
          vatRate: Number(invoice.vatRate),
          vatAmount: Number(invoice.vatAmount),
          totalAmount: Number(invoice.totalAmount),
          notes: notes || null,
          tenantId,
        },
        include: {
          invoice: { select: { id: true, invoiceNumber: true } },
        },
      });

      return created;
    });

    await createAuditLog({
      action: "CREATE",
      entityType: "TaxInvoice",
      entityId: taxInvoice.id,
      entityNumber: taxInvoice.taxInvoiceNumber,
      userId: session!.user.id,
      userName: session!.user.name || "",
      tenantId,
    });

    return NextResponse.json(JSON.parse(JSON.stringify(taxInvoice)), {
      status: 201,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    console.error("POST /api/finance/tax-invoices error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
