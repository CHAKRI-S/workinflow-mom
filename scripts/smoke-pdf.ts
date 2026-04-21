/**
 * PDF smoke test: render each template to buffer.
 * Verifies watermark + status changes didn't break templates.
 *
 * Run: npx tsx scripts/smoke-pdf.ts
 */
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { InvoiceGoodsPdf } from "../src/lib/pdf/templates/invoice-goods";
import { InvoiceServicePdf } from "../src/lib/pdf/templates/invoice-service";
import { InvoiceMixedPdf } from "../src/lib/pdf/templates/invoice-mixed";
import { ReceiptPdf } from "../src/lib/pdf/templates/receipt";
import { TaxInvoicePdf } from "../src/lib/pdf/templates/tax-invoice";
import { SubscriptionInvoicePdf } from "../src/lib/pdf/templates/subscription-invoice";
import type {
  InvoicePdfData,
  ReceiptPdfData,
  SubscriptionInvoicePdfData,
  TaxInvoicePdfData,
} from "../src/lib/pdf/types";
import type { HeaderTenant } from "../src/lib/pdf/components/Header";
import type { Party } from "../src/lib/pdf/components/PartyBlock";
import type { PdfLineItem } from "../src/lib/pdf/components/LineItemsTable";

const mockTenant: HeaderTenant = {
  name: "WorkinFlow Test Factory Co., Ltd.",
  address: "123 Test Road, Bangkok 10100",
  taxId: "0105555123456",
  phone: "02-123-4567",
  email: "test@workinflow.cloud",
};

const mockParty: Party = {
  name: "Acme Corporation",
  taxId: "0105556789012",
  address: "456 Buyer St, Bangkok 10200",
  phone: null,
  email: null,
  contactPerson: null,
};

const mockItem: PdfLineItem = {
  no: 1,
  productCode: "CNC-001",
  description: "CNC Machined Part - Custom",
  quantity: 10,
  unit: "ชิ้น",
  unitPrice: 500,
  lineTotal: 5000,
};

const mockInvoiceData: InvoicePdfData = {
  tenant: mockTenant,
  seller: mockParty,
  buyer: mockParty,
  doc: {
    number: "INV-2026-0001",
    issueDate: new Date("2026-04-21"),
    dueDate: new Date("2026-05-21"),
    reference: null,
    copyLabel: null,
    billingNature: "GOODS",
  },
  items: [mockItem],
  totals: {
    subtotal: 5000,
    discountAmount: 0,
    vatRate: 7,
    vatAmount: 350,
    totalAmount: 5350,
    whtRate: null,
    whtAmount: null,
  },
  notes: null,
  createdBy: "Test User",
  linesBillingNature: { 1: "GOODS" },
  status: "CANCELLED", // test watermark
};

const mockReceiptData: ReceiptPdfData = {
  tenant: mockTenant,
  seller: mockParty,
  payer: mockParty,
  doc: {
    number: "RCP-2026-0001",
    issueDate: new Date("2026-04-21"),
    billingNature: "GOODS",
    invoiceNumber: "INV-2026-0001",
  },
  summary: { description: "ชำระตามใบแจ้งหนี้ INV-2026-0001" },
  totals: {
    grossAmount: 5350,
    whtRate: 3,
    whtAmount: 150,
    netAmount: 5200,
  },
  whtCertNumber: null,
  notes: null,
  createdBy: "Test User",
  status: "ISSUED",
};

const mockSubscriptionInvoiceData: SubscriptionInvoicePdfData = {
  doc: {
    number: "INV-202604-0001",
    issueDate: new Date("2026-04-21"),
    paidAt: new Date("2026-04-21"),
  },
  buyer: {
    name: "Acme Factory Co., Ltd.",
    taxId: "0105556789012",
    address: "456 Buyer St, Bangkok 10200",
  },
  lineItem: {
    planName: "Professional",
    billingCycle: "MONTHLY",
    periodStart: new Date("2026-04-21"),
    periodEnd: new Date("2026-05-21"),
  },
  totals: {
    subtotalSatang: 200_000, // 2,000 THB
    discountSatang: 0,
    vatSatang: 14_000, // 140 THB
    totalSatang: 214_000, // 2,140 THB
  },
  status: null,
};

const mockTaxInvoiceData: TaxInvoicePdfData = {
  tenant: mockTenant,
  seller: mockParty,
  buyer: mockParty,
  doc: {
    number: "TAX-2026-0001",
    issueDate: new Date("2026-04-21"),
    invoiceNumber: "INV-2026-0001",
    billingNature: "GOODS",
    copyLabel: "ต้นฉบับ",
  },
  items: [mockItem],
  totals: {
    subtotal: 5000,
    vatRate: 7,
    vatAmount: 350,
    totalAmount: 5350,
  },
  notes: null,
  status: "CANCELLED", // test watermark
};

async function smoke(name: string, el: ReturnType<typeof createElement>) {
  const buf = await renderToBuffer(el as never);
  console.log(`  OK  ${name.padEnd(30)} ${buf.length} bytes`);
  if (buf.length < 1000) throw new Error(`${name} too small`);
}

async function main() {
  console.log("PDF smoke test (watermark + status field)");
  await smoke(
    "invoice-goods (CANCELLED)",
    createElement(InvoiceGoodsPdf, { data: mockInvoiceData })
  );
  await smoke(
    "invoice-service",
    createElement(InvoiceServicePdf, {
      data: {
        ...mockInvoiceData,
        status: "ISSUED",
        doc: { ...mockInvoiceData.doc, billingNature: "MANUFACTURING_SERVICE" },
      },
    })
  );
  await smoke(
    "invoice-mixed",
    createElement(InvoiceMixedPdf, {
      data: {
        ...mockInvoiceData,
        status: "ISSUED",
        doc: { ...mockInvoiceData.doc, billingNature: "MIXED" },
      },
    })
  );
  await smoke("receipt", createElement(ReceiptPdf, { data: mockReceiptData }));
  await smoke(
    "tax-invoice (CANCELLED)",
    createElement(TaxInvoicePdf, { data: mockTaxInvoiceData })
  );
  await smoke(
    "subscription-invoice",
    createElement(SubscriptionInvoicePdf, {
      data: mockSubscriptionInvoiceData,
    })
  );
  console.log("All templates rendered OK");
}

main().catch((e) => {
  console.error("SMOKE FAIL:", e);
  process.exit(1);
});
