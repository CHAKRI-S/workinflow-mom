import type { HeaderTenant } from "./components/Header";
import type { Party } from "./components/PartyBlock";
import type { PdfLineItem } from "./components/LineItemsTable";

export interface InvoicePdfData {
  tenant: HeaderTenant;
  /**
   * Phase 8.12 — Tenant VAT registration status. Controls:
   * - PDF title ("ใบกำกับภาษี / ใบแจ้งหนี้" vs plain "ใบแจ้งหนี้")
   * - Whether VAT line renders in TotalsBox
   * Defaults to true via schema default; non-VAT tenants flip to false.
   */
  tenantIsVatRegistered: boolean;
  buyer: Party;
  seller: Party;
  /** Document status — when "CANCELLED", renders a red diagonal watermark */
  status?: string | null;
  doc: {
    number: string;
    issueDate: Date | string;
    dueDate?: Date | string | null;
    reference?: string | null;
    copyLabel?: string | null;
    billingNature: "GOODS" | "MANUFACTURING_SERVICE" | "MIXED";
  };
  items: PdfLineItem[];
  // Per-line billing nature for MIXED mode
  linesBillingNature?: Record<number, "GOODS" | "MANUFACTURING_SERVICE" | null>;
  totals: {
    subtotal: number | string;
    discountAmount?: number | string | null;
    vatRate: number | string;
    vatAmount: number | string;
    totalAmount: number | string; // ยอดก่อนหัก WHT
    whtRate?: number | string | null;
    whtAmount?: number | string | null;
  };
  notes?: string | null;
  createdBy?: string | null;
  oemDisclaimer?: boolean; // ถ้าเป็น OEM goods + มี customer branding → แสดงหมายเหตุ
}

export interface ReceiptPdfData {
  tenant: HeaderTenant;
  /** Phase 8.12 — see InvoicePdfData.tenantIsVatRegistered */
  tenantIsVatRegistered: boolean;
  payer: Party; // ผู้จ่ายเงิน
  seller: Party;
  /** Document status — when "CANCELLED", renders a red diagonal watermark */
  status?: string | null;
  doc: {
    number: string;
    issueDate: Date | string;
    billingNature: "GOODS" | "MANUFACTURING_SERVICE" | "MIXED";
    invoiceNumber?: string | null; // อ้างอิงใบแจ้งหนี้
  };
  // One-line summary per receipt
  summary: {
    description: string; // e.g. "รับชำระตามใบแจ้งหนี้ INV-..."
  };
  totals: {
    grossAmount: number | string; // ยอดก่อนหัก WHT
    whtRate?: number | string | null;
    whtAmount?: number | string | null;
    netAmount: number | string; // ยอดรับจริง (= grossAmount - whtAmount)
  };
  whtCertNumber?: string | null;
  notes?: string | null;
  createdBy?: string | null;
}

export interface SubscriptionInvoicePdfData {
  /** Document status — when "CANCELLED", renders a red diagonal watermark */
  status?: string | null;
  doc: {
    number: string;
    issueDate: Date | string;
    paidAt?: Date | string | null;
  };
  /**
   * Platform issuer info (WorkinFlow itself — ผู้ให้บริการ). Comes from the
   * PlatformSettings singleton managed by super admin at /superadmin/settings.
   * Blank strings render as "[SETUP REQUIRED]" so unfilled production data
   * is visibly obvious on the PDF.
   */
  issuer: {
    name: string;
    taxId: string;
    address: string;
    phone: string;
    email: string;
  };
  /** Tenant info (the buyer of the SaaS service) */
  buyer: Party;
  lineItem: {
    planName: string;
    billingCycle: "MONTHLY" | "YEARLY";
    periodStart: Date | string;
    periodEnd: Date | string;
  };
  totals: {
    subtotalSatang: number;
    discountSatang: number;
    vatSatang: number;
    totalSatang: number;
  };
}

export interface TaxInvoicePdfData {
  tenant: HeaderTenant;
  /**
   * Phase 8.12 — A tax invoice should NEVER be issued by a non-VAT tenant.
   * API routes must block generation; this flag lets template render a
   * defensive banner if somehow a non-VAT tenant reaches rendering.
   */
  tenantIsVatRegistered: boolean;
  buyer: Party;
  seller: Party;
  /** Document status — when "CANCELLED", renders a red diagonal watermark */
  status?: string | null;
  doc: {
    number: string;
    issueDate: Date | string;
    invoiceNumber?: string | null;
    billingNature: "GOODS" | "MANUFACTURING_SERVICE" | "MIXED";
    copyLabel?: string | null;
  };
  items: PdfLineItem[];
  totals: {
    subtotal: number | string;
    vatRate: number | string;
    vatAmount: number | string;
    totalAmount: number | string;
  };
  notes?: string | null;
}
