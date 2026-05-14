import type {
  InvoicePdfData,
  ReceiptPdfData,
  SubscriptionInvoicePdfData,
  TaxInvoicePdfData,
} from "./types";
import { formatCustomerDisplayName } from "@/lib/customer-name";
import { normalizeCurrencyCode } from "@/lib/currency";
import { normalizeDocumentTaxType } from "@/lib/tax-type";

type Dec = { toString: () => string } | number | string | null | undefined;

function n(x: Dec): number {
  return Number(x?.toString?.() ?? x ?? 0);
}

function brandingLabel(json: unknown): string | null {
  if (!json || typeof json !== "object") return null;
  const obj = json as Record<string, unknown>;
  // Phase 8.9 MVP shape — `mark` is the canonical short label
  const mark = obj.mark;
  const method = obj.method || obj.markingMethod;
  // Back-compat: older Phase 8B rows wrote { logoName|name, markingMethod, position }
  const legacyName = obj.logoName || obj.name;
  const position = obj.position;

  const parts: string[] = [];
  if (mark) parts.push(String(mark));
  else if (legacyName) parts.push(String(legacyName));
  if (method) parts.push(String(method));
  if (position) parts.push(String(position));
  if (parts.length === 0) return null;
  return parts.join(" · ");
}

// ---------- Tenant shape (shared) ----------
export interface TenantLike {
  name: string;
  taxId?: string | null;
  branchNo?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  /**
   * Phase 8.12 — if false, PDFs drop "ใบกำกับภาษี" from titles and hide
   * VAT line in totals. Default true keeps existing behavior for tenants
   * that haven't explicitly opted out.
   */
  isVatRegistered?: boolean;
}

// ---------- Invoice mapper ----------

export interface InvoiceWithLines {
  invoiceNumber: string;
  status?: string | null;
  issueDate: Date;
  dueDate: Date;
  billingNature: string;
  taxType?: string | null;
  currencyCode?: string | null;
  snapshotCustomerName: string | null;
  snapshotCustomerAddress: string | null;
  snapshotCustomerTaxId: string | null;
  subtotal: Dec;
  discountAmount: Dec;
  vatRate: Dec;
  vatAmount: Dec;
  totalAmount: Dec;
  whtRate: Dec;
  whtAmount: Dec;
  notes: string | null;
  salesOrder?: { orderNumber?: string | null } | null;
  customer: {
    name: string;
    billingAddress?: string | null;
    taxId?: string | null;
    branchNo?: string | null;
    phone?: string | null;
    email?: string | null;
    juristicType?: string | null;
    individualTitle?: string | null;
    individualTitleOther?: string | null;
  };
  createdBy?: { name: string | null } | null;
  lines: Array<{
    sortOrder: number;
    description: string;
    productCode: string | null;
    drawingRevision: string | null;
    customerBranding: unknown;
    lineBillingNature: string | null;
    quantity: Dec;
    enteredUnitPrice?: Dec;
    unitPrice: Dec;
    vatPriceMode?: string | null;
    lineTotal: Dec;
  }>;
}

export function mapInvoiceToPdfData(
  invoice: InvoiceWithLines,
  tenant: TenantLike
): InvoicePdfData {
  const sortedLines = [...invoice.lines].sort(
    (a, b) => a.sortOrder - b.sortOrder
  );

  const items = sortedLines.map((l, idx) => ({
    no: idx + 1,
    productCode: l.productCode,
    description: l.description,
    drawingRevision: l.drawingRevision,
    customerBranding: brandingLabel(l.customerBranding),
    quantity: n(l.quantity),
    unitPrice: n(l.unitPrice),
    vatPriceMode: l.vatPriceMode,
    lineTotal: n(l.lineTotal),
  }));

  const linesBillingNature: Record<
    number,
    "GOODS" | "MANUFACTURING_SERVICE" | null
  > = {};
  // Per-line billing nature snapshot copied from InvoiceLine snapshot from Product/SO at invoice creation time.
  // MIXED PDFs use this evidence to split goods vs manufacturing-service sections.
  sortedLines.forEach((l, idx) => {
    const v = l.lineBillingNature;
    if (v === "GOODS" || v === "MANUFACTURING_SERVICE") {
      linesBillingNature[idx + 1] = v;
    } else {
      linesBillingNature[idx + 1] = null;
    }
  });

  // OEM disclaimer shown when invoice is GOODS but at least one line has
  // customer branding — warns the customer that marking doesn't flip classification
  const hasBranding = sortedLines.some(
    (l) => brandingLabel(l.customerBranding) !== null
  );
  const oemDisclaimer = invoice.billingNature === "GOODS" && hasBranding;

  // Document tax type is the current source of truth for VAT wording/totals.
  const taxType = normalizeDocumentTaxType(invoice.taxType);
  const currencyCode = normalizeCurrencyCode(invoice.currencyCode);
  const tenantIsVatRegistered = taxType !== "NO_VAT";
  const formattedCustomerName = formatCustomerDisplayName({
    name: invoice.customer.name,
    juristicType: invoice.customer.juristicType,
    individualTitle: invoice.customer.individualTitle,
    individualTitleOther: invoice.customer.individualTitleOther,
  });
  const customerDisplayName =
    invoice.snapshotCustomerName && invoice.snapshotCustomerName !== invoice.customer.name
      ? invoice.snapshotCustomerName
      : formattedCustomerName;

  return {
    tenant,
    tenantIsVatRegistered,
    taxType,
    currencyCode,
    status: invoice.status ?? null,
    seller: {
      name: tenant.name,
      address: tenant.address,
      taxId: tenant.taxId,
      branchNo: tenant.branchNo,
      phone: tenant.phone,
      email: tenant.email,
    },
    buyer: {
      name: customerDisplayName,
      address:
        invoice.snapshotCustomerAddress ||
        invoice.customer.billingAddress ||
        null,
      taxId: invoice.snapshotCustomerTaxId || invoice.customer.taxId,
      branchNo: invoice.customer.branchNo,
      phone: invoice.customer.phone,
      email: invoice.customer.email,
    },
    doc: {
      number: invoice.invoiceNumber,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      reference: invoice.salesOrder?.orderNumber || null,
      billingNature: invoice.billingNature as InvoicePdfData["doc"]["billingNature"],
    },
    items,
    linesBillingNature,
    totals: {
      subtotal: n(invoice.subtotal),
      discountAmount: n(invoice.discountAmount),
      vatRate: n(invoice.vatRate),
      vatAmount: n(invoice.vatAmount),
      totalAmount: n(invoice.totalAmount),
      whtRate: n(invoice.whtRate),
      whtAmount: n(invoice.whtAmount),
    },
    notes: invoice.notes,
    createdBy: invoice.createdBy?.name,
    oemDisclaimer,
  };
}

// ---------- Receipt mapper ----------

export interface ReceiptForPdf {
  receiptNumber: string;
  status?: string | null;
  issueDate: Date;
  billingNature: string;
  taxType?: string | null;
  currencyCode?: string | null;
  grossAmount: Dec;
  amount: Dec; // net after WHT
  whtRate: Dec;
  whtAmount: Dec;
  whtCertNumber: string | null;
  payerName: string;
  payerAddress: string | null;
  payerTaxId: string | null;
  notes: string | null;
  createdBy?: { name: string | null } | null;
  invoice: {
    invoiceNumber: string;
    customer: {
      branchNo?: string | null;
      phone?: string | null;
      email?: string | null;
    } | null;
  };
}

export function mapReceiptToPdfData(
  r: ReceiptForPdf,
  tenant: TenantLike
): ReceiptPdfData {
  const gross = n(r.grossAmount) || n(r.amount); // fallback ถ้าไม่มี WHT
  const taxType = normalizeDocumentTaxType(r.taxType);
  const currencyCode = normalizeCurrencyCode(r.currencyCode);
  return {
    tenant,
    tenantIsVatRegistered: taxType !== "NO_VAT",
    taxType,
    currencyCode,
    status: r.status ?? null,
    seller: {
      name: tenant.name,
      address: tenant.address,
      taxId: tenant.taxId,
      branchNo: tenant.branchNo,
      phone: tenant.phone,
      email: tenant.email,
    },
    payer: {
      name: r.payerName,
      address: r.payerAddress,
      taxId: r.payerTaxId,
    },
    doc: {
      number: r.receiptNumber,
      issueDate: r.issueDate,
      billingNature: r.billingNature as ReceiptPdfData["doc"]["billingNature"],
      invoiceNumber: r.invoice.invoiceNumber,
    },
    summary: {
      description: `รับชำระตามใบแจ้งหนี้เลขที่ ${r.invoice.invoiceNumber}`,
    },
    totals: {
      grossAmount: gross,
      whtRate: n(r.whtRate),
      whtAmount: n(r.whtAmount),
      netAmount: n(r.amount),
    },
    whtCertNumber: r.whtCertNumber,
    notes: r.notes,
    createdBy: r.createdBy?.name,
  };
}

// ---------- Tax Invoice mapper ----------

export interface TaxInvoiceForPdf {
  taxInvoiceNumber: string;
  status?: string | null;
  issueDate: Date;
  billingNature: string;
  taxType?: string | null;
  currencyCode?: string | null;
  buyerName: string;
  buyerTaxId: string | null;
  buyerAddress: string | null;
  buyerBranch: string | null;
  sellerName: string;
  sellerTaxId: string | null;
  sellerAddress: string | null;
  subtotal: Dec;
  vatRate: Dec;
  vatAmount: Dec;
  totalAmount: Dec;
  notes: string | null;
  invoice: {
    invoiceNumber: string;
    lines: Array<{
      sortOrder: number;
      description: string;
      productCode: string | null;
      drawingRevision: string | null;
      customerBranding: unknown;
      quantity: Dec;
      enteredUnitPrice?: Dec;
      unitPrice: Dec;
      vatPriceMode?: string | null;
      lineTotal: Dec;
    }>;
  };
}

// ---------- Subscription Invoice mapper ----------

export interface SubscriptionInvoiceForPdf {
  invoiceNumber: string;
  issueDate: Date;
  paidAt: Date | null;
  tenantName: string;
  tenantTaxId: string | null;
  tenantAddress: string | null;
  planName: string;
  subtotalSatang: number;
  discountSatang: number;
  vatSatang: number;
  totalSatang: number;
}

export interface SubscriptionForPdf {
  billingCycle: "MONTHLY" | "YEARLY";
  periodStart: Date;
  periodEnd: Date;
}

/** Platform issuer info — from PlatformSettings singleton (DB-backed) */
export interface PlatformIssuerForPdf {
  issuerName: string;
  issuerTaxId: string;
  issuerAddress: string;
  issuerPhone: string;
  issuerEmail: string;
}

export function mapSubscriptionInvoiceForPdf(
  invoice: SubscriptionInvoiceForPdf,
  subscription: SubscriptionForPdf,
  plan: { name: string },
  issuer: PlatformIssuerForPdf
): SubscriptionInvoicePdfData {
  return {
    status: null,
    doc: {
      number: invoice.invoiceNumber,
      issueDate: invoice.issueDate,
      paidAt: invoice.paidAt,
    },
    issuer: {
      name: issuer.issuerName,
      taxId: issuer.issuerTaxId,
      address: issuer.issuerAddress,
      phone: issuer.issuerPhone,
      email: issuer.issuerEmail,
    },
    buyer: {
      name: invoice.tenantName,
      taxId: invoice.tenantTaxId,
      address: invoice.tenantAddress,
    },
    lineItem: {
      planName: invoice.planName || plan.name,
      billingCycle: subscription.billingCycle,
      periodStart: subscription.periodStart,
      periodEnd: subscription.periodEnd,
    },
    totals: {
      subtotalSatang: invoice.subtotalSatang,
      discountSatang: invoice.discountSatang,
      vatSatang: invoice.vatSatang,
      totalSatang: invoice.totalSatang,
    },
  };
}

export function mapTaxInvoiceToPdfData(
  ti: TaxInvoiceForPdf,
  tenant: TenantLike
): TaxInvoicePdfData {
  const sortedLines = [...ti.invoice.lines].sort(
    (a, b) => a.sortOrder - b.sortOrder
  );
  const taxType = normalizeDocumentTaxType(ti.taxType);
  const currencyCode = normalizeCurrencyCode(ti.currencyCode);
  return {
    tenant,
    tenantIsVatRegistered: taxType !== "NO_VAT",
    taxType,
    currencyCode,
    status: ti.status ?? null,
    seller: {
      name: ti.sellerName,
      address: ti.sellerAddress,
      taxId: ti.sellerTaxId,
    },
    buyer: {
      name: ti.buyerName,
      address: ti.buyerAddress,
      taxId: ti.buyerTaxId,
      branchNo: ti.buyerBranch,
    },
    doc: {
      number: ti.taxInvoiceNumber,
      issueDate: ti.issueDate,
      invoiceNumber: ti.invoice.invoiceNumber,
      billingNature: ti.billingNature as TaxInvoicePdfData["doc"]["billingNature"],
    },
    items: sortedLines.map((l, idx) => ({
      no: idx + 1,
      productCode: l.productCode,
      description: l.description,
      drawingRevision: l.drawingRevision,
      customerBranding: brandingLabel(l.customerBranding),
      quantity: n(l.quantity),
      unitPrice: n(l.unitPrice),
      vatPriceMode: l.vatPriceMode,
      lineTotal: n(l.lineTotal),
    })),
    totals: {
      subtotal: n(ti.subtotal),
      vatRate: n(ti.vatRate),
      vatAmount: n(ti.vatAmount),
      totalAmount: n(ti.totalAmount),
    },
    notes: ti.notes,
  };
}
