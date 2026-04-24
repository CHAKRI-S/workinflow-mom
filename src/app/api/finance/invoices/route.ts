import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";
import { generateDocNumber, invoicePrefix } from "@/lib/doc-numbering";
import { createAuditLog } from "@/lib/audit";
import { Prisma } from "@/generated/prisma/client";
import { suggestBillingNature } from "@/lib/validators/billing-nature";

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
      billingNature: headerBillingNature,
    } = body;

    if (!salesOrderId || !invoiceType || !dueDate || !lines?.length) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const tenantId = session!.user.tenantId;

    // Fetch sales order with customer + lines (to inherit drawingSource defaults)
    // + tenant VAT status (Phase 8.12 — a non-VAT seller cannot issue VAT docs)
    const [salesOrder, tenant] = await Promise.all([
      prisma.salesOrder.findFirst({
        where: { id: salesOrderId, tenantId },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              isVatRegistered: true,
              taxId: true,
              billingAddress: true,
              shippingAddress: true,
              defaultBillingNature: true,
              withholdsTax: true,
            },
          },
          lines: {
            select: {
              id: true,
              drawingSource: true,
              lineBillingNature: true,
              productCode: true,
              drawingRevision: true,
              customerDrawingUrl: true,
              customerBranding: true,
            },
          },
        },
      }),
      prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { isVatRegistered: true },
      }),
    ]);

    if (!salesOrder || !salesOrder.customer) {
      return NextResponse.json(
        { error: "Sales order or customer not found" },
        { status: 404 }
      );
    }

    const customer = salesOrder.customer;
    // A doc is a VAT doc only if BOTH seller and buyer are VAT-registered.
    const tenantIsVat = tenant?.isVatRegistered ?? true;
    const isVatDoc = tenantIsVat && customer.isVatRegistered;
    const vatRate = isVatDoc ? 7 : 0;

    // Map SO lines by id for inheritance lookup
    const soLineById = new Map(salesOrder.lines.map((l) => [l.id, l]));

    // Calculate line totals + inherit drawing/branding from SO line (body overrides inheritance)
    const linesWithTotals = lines.map(
      (
        line: {
          salesOrderLineId?: string;
          description: string;
          quantity: number;
          unitPrice: number;
          notes?: string;
          sortOrder?: number;
          drawingSource?: "TENANT_OWNED" | "CUSTOMER_PROVIDED" | "JOINT_DEVELOPMENT";
          lineBillingNature?: "GOODS" | "MANUFACTURING_SERVICE" | "MIXED" | null;
          productCode?: string | null;
          drawingRevision?: string | null;
          customerDrawingUrl?: string | null;
          customerBranding?: Record<string, unknown> | null;
        },
        idx: number
      ) => {
        const qty = Number(line.quantity);
        const price = Number(line.unitPrice);
        const lineTotal = Math.round(qty * price * 100) / 100;

        const soLine = line.salesOrderLineId
          ? soLineById.get(line.salesOrderLineId)
          : undefined;

        return {
          salesOrderLineId: line.salesOrderLineId || null,
          description: line.description,
          quantity: qty,
          unitPrice: price,
          lineTotal,
          notes: line.notes || null,
          sortOrder: line.sortOrder ?? idx,
          drawingSource: line.drawingSource ?? soLine?.drawingSource ?? "TENANT_OWNED",
          lineBillingNature: line.lineBillingNature ?? soLine?.lineBillingNature ?? null,
          productCode: line.productCode ?? soLine?.productCode ?? null,
          drawingRevision: line.drawingRevision ?? soLine?.drawingRevision ?? null,
          customerDrawingUrl:
            line.customerDrawingUrl ?? soLine?.customerDrawingUrl ?? null,
          customerBranding:
            (line.customerBranding ??
              (soLine?.customerBranding as Record<string, unknown> | null | undefined) ??
              undefined) as Prisma.InputJsonValue | undefined,
        };
      }
    );

    // Resolve billingNature: body override > SO snapshot > customer default > auto-suggest > GOODS
    const suggested = suggestBillingNature(
      linesWithTotals.map((l: { drawingSource: "TENANT_OWNED" | "CUSTOMER_PROVIDED" | "JOINT_DEVELOPMENT" }) => ({
        drawingSource: l.drawingSource,
      }))
    );
    const billingNature =
      headerBillingNature ??
      salesOrder.billingNature ??
      customer.defaultBillingNature ??
      suggested ??
      "GOODS";

    // Auto-set WHT defaults for service
    const isService = billingNature === "MANUFACTURING_SERVICE";
    const whtRate = isService && customer.withholdsTax ? 3 : 0;
    const whtCertStatus = whtRate > 0 ? "PENDING" : "NOT_APPLICABLE";

    // Calculate totals
    const subtotal = linesWithTotals.reduce(
      (sum: number, l: { lineTotal: number }) => sum + l.lineTotal,
      0
    );
    const discountAmount = 0;
    const afterDiscount = subtotal - discountAmount;
    const vatAmount = Math.round((afterDiscount * vatRate) / 100);
    const totalAmount = Math.round((afterDiscount + vatAmount) * 100) / 100;

    const invoice = await prisma.$transaction(async (tx) => {
      const prefix = invoicePrefix(tenantIsVat, customer.isVatRegistered);
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
          billingNature,
          whtRate,
          whtCertStatus,
          notes: notes || null,
          snapshotCustomerName: customer.name,
          snapshotCustomerAddress: customer.billingAddress || customer.shippingAddress || null,
          snapshotCustomerTaxId: customer.taxId || null,
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

    await createAuditLog({
      action: "CREATE",
      entityType: "Invoice",
      entityId: invoice.id,
      entityNumber: invoice.invoiceNumber,
      userId: session!.user.id,
      userName: session!.user.name || "",
      tenantId,
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
