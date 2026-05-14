import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";
import { generateDocNumber, invoicePrefixFromTaxType } from "@/lib/doc-numbering";
import { createAuditLog } from "@/lib/audit";
import { Prisma } from "@/generated/prisma/client";
import {
  billingNatureFromProductKind,
  type BillingNature,
  type ProductKind,
} from "@/lib/product-billing";
import { invoiceCreateSchema } from "@/lib/validators/invoice";
import { calculateDocumentTotals, inheritDocumentTaxAndCurrency } from "@/lib/document-tax-propagation";
import { formatCustomerDisplayName } from "@/lib/customer-name";

class InvoiceSalesOrderLineLookupError extends Error {
  constructor(salesOrderLineId: string | null | undefined) {
    super(`Sales order line not found for invoice line: ${salesOrderLineId ?? "<missing>"}`);
    this.name = "InvoiceSalesOrderLineLookupError";
  }
}

function deriveInvoiceBillingNature(
  lines: Array<{ lineBillingNature?: BillingNature | null }>,
): BillingNature {
  if (!lines.length) return "GOODS";

  const natures = lines.map((line) => line.lineBillingNature ?? "GOODS");
  if (natures.every((nature) => nature === "GOODS")) return "GOODS";
  if (natures.every((nature) => nature === "MANUFACTURING_SERVICE")) {
    return "MANUFACTURING_SERVICE";
  }
  return "MIXED";
}

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
    const data = invoiceCreateSchema.parse(body);
    const {
      salesOrderId,
      invoiceType,
      dueDate,
      lines,
      notes,
    } = data;

    const tenantId = session!.user.tenantId;

    // Fetch sales order with customer + lines (to inherit tax/currency and drawingSource defaults)
    const salesOrder = await prisma.salesOrder.findFirst({
      where: { id: salesOrderId, tenantId },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            taxId: true,
            billingAddress: true,
            shippingAddress: true,
            juristicType: true,
            individualTitle: true,
            individualTitleOther: true,
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
            enteredUnitPrice: true,
            vatPriceMode: true,
            product: {
              select: {
                id: true,
                code: true,
                productKind: true,
                drawingSource: true,
                drawingRevision: true,
                customerDrawingUrl: true,
                fusionFileUrl: true,
              },
            },
          },
        },
      },
    });

    if (!salesOrder || !salesOrder.customer) {
      return NextResponse.json(
        { error: "Sales order or customer not found" },
        { status: 404 }
      );
    }

    const customer = salesOrder.customer;
    const customerDisplayName = formatCustomerDisplayName({
      name: customer.name,
      juristicType: customer.juristicType,
      individualTitle: customer.individualTitle,
      individualTitleOther: customer.individualTitleOther,
    });
    const inherited = inheritDocumentTaxAndCurrency({
      source: salesOrder,
      override: {
        taxType: Object.prototype.hasOwnProperty.call(body, "taxType") ? data.taxType : undefined,
        currencyCode: Object.prototype.hasOwnProperty.call(body, "currencyCode")
          ? data.currencyCode
          : undefined,
      },
    });

    // Map SO lines by id for inheritance lookup
    const soLineById = new Map(salesOrder.lines.map((l) => [l.id, l]));

    const lineInputs = lines.map((line) => {
      const soLine = line.salesOrderLineId
        ? soLineById.get(line.salesOrderLineId)
        : undefined;

      return {
        ...line,
        enteredUnitPrice: line.enteredUnitPrice ?? line.unitPrice,
        vatPriceMode: soLine?.vatPriceMode ?? line.vatPriceMode ?? "EXCLUSIVE",
      };
    });
    const totals = calculateDocumentTotals({
      taxType: inherited.taxType,
      currencyCode: inherited.currencyCode,
      lines: lineInputs,
    });

    // Calculate line totals + inherit authoritative snapshots from SO line.
    // If an old SO line has missing snapshots, fall back to the Product relation on that SO line.
    const linesWithTotals = lineInputs.map((line, idx) => {
      const calculated = totals.lines[idx];
      const qty = Number(line.quantity);
      const soLine = line.salesOrderLineId
        ? soLineById.get(line.salesOrderLineId)
        : undefined;

      if (!soLine) {
        throw new InvoiceSalesOrderLineLookupError(line.salesOrderLineId);
      }

      const product = soLine.product;
      const lineBillingNature =
        soLine.lineBillingNature ??
        billingNatureFromProductKind(product?.productKind as ProductKind | null | undefined);

      return {
        salesOrderLineId: line.salesOrderLineId || null,
        description: line.description,
        quantity: qty,
        enteredUnitPrice: calculated.enteredUnitPrice,
        unitPrice: calculated.unitPrice,
        vatPriceMode: calculated.vatPriceMode,
        lineTotal: calculated.lineTotal,
        notes: line.notes || null,
        sortOrder: line.sortOrder ?? idx,
        drawingSource: soLine.drawingSource ?? product?.drawingSource ?? "TENANT_OWNED",
        lineBillingNature,
        productCode: soLine.productCode ?? product?.code ?? null,
        drawingRevision: soLine.drawingRevision ?? product?.drawingRevision ?? null,
        customerDrawingUrl:
          soLine.customerDrawingUrl ??
          product?.customerDrawingUrl ??
          product?.fusionFileUrl ??
          null,
        customerBranding:
          ((soLine.customerBranding as Record<string, unknown> | null | undefined) ??
            undefined) as Prisma.InputJsonValue | undefined,
      };
    });

    const billingNature = salesOrder.billingNature ?? deriveInvoiceBillingNature(linesWithTotals);

    // Auto-set WHT defaults for service
    const isService = billingNature === "MANUFACTURING_SERVICE";
    const whtRate = isService && customer.withholdsTax ? 3 : 0;
    const whtCertStatus = whtRate > 0 ? "PENDING" : "NOT_APPLICABLE";

    const invoice = await prisma.$transaction(async (tx) => {
      const prefix = invoicePrefixFromTaxType(totals.taxType);
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
          subtotal: totals.subtotal,
          discountAmount: totals.discountAmount,
          vatRate: totals.vatRate,
          vatAmount: totals.vatAmount,
          totalAmount: totals.totalAmount,
          vatModePolicy: totals.vatModePolicy,
          taxType: totals.taxType,
          currencyCode: totals.currencyCode,
          paidAmount: 0,
          billingNature,
          whtRate,
          whtCertStatus,
          notes: notes || null,
          snapshotCustomerName: customerDisplayName,
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
    if (err instanceof Error && err.name === "ZodError") {
      return NextResponse.json({ error: "Validation failed", details: err }, { status: 400 });
    }
    if (err instanceof InvoiceSalesOrderLineLookupError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("POST /api/finance/invoices error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
