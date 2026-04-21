import type { HeaderTenant } from "./components/Header";
import type { Party } from "./components/PartyBlock";
import type { PdfLineItem } from "./components/LineItemsTable";

export interface InvoicePdfData {
  tenant: HeaderTenant;
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

export interface TaxInvoicePdfData {
  tenant: HeaderTenant;
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
