import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { mapInvoiceToPdfData, mapReceiptToPdfData, mapTaxInvoiceToPdfData } from "@/lib/pdf/mappers";
import { formatPdfMoney, pdfAmountText } from "@/lib/pdf/format";

const repoRoot = process.cwd();
const readSource = (path: string) => readFileSync(join(repoRoot, path), "utf8");

const invoiceCreateRoute = readSource("src/app/api/finance/invoices/route.ts");
const taxInvoiceCreateRoute = readSource("src/app/api/finance/tax-invoices/route.ts");
const taxInvoicePdfRoute = readSource("src/app/api/finance/tax-invoices/[id]/pdf/route.ts");
const totalsBoxSource = readSource("src/lib/pdf/components/TotalsBox.tsx");
const lineItemsSource = readSource("src/lib/pdf/components/LineItemsTable.tsx");
const receiptTemplateSource = readSource("src/lib/pdf/templates/receipt.tsx");

describe("downstream finance PDF tax and currency contracts", () => {
  it("formats PDF amounts with document currency and avoids Thai baht words for non-THB", () => {
    expect(formatPdfMoney(1234.5, "USD")).toBe("$1,234.50");
    expect(formatPdfMoney(1234.5, "THB")).toBe("฿1,234.50");
    expect(pdfAmountText(1234.5, "THB")).toContain("บาท");
    expect(pdfAmountText(1234.5, "USD")).toBe("$1,234.50");
    expect(pdfAmountText(1234.5, "USD")).not.toContain("บาท");
  });

  it("maps invoice PDFs with formatted legal customer name, tax type, and currency", () => {
    const invoice = {
      invoiceNumber: "INV-1",
      status: "DRAFT",
      issueDate: new Date("2026-05-13"),
      dueDate: new Date("2026-05-20"),
      billingNature: "GOODS",
      taxType: "VAT_EXCLUSIVE",
      currencyCode: "USD",
      snapshotCustomerName: null,
      snapshotCustomerAddress: null,
      snapshotCustomerTaxId: null,
      subtotal: 100,
      discountAmount: 0,
      vatRate: 7,
      vatAmount: 7,
      totalAmount: 107,
      whtRate: 0,
      whtAmount: 0,
      notes: null,
      salesOrder: { orderNumber: "SO-1" },
      customer: {
        name: "เอบีซี",
        juristicType: "COMPANY_LTD",
        individualTitle: null,
        individualTitleOther: null,
        billingAddress: "Bangkok",
        taxId: "123",
        branchNo: null,
        phone: null,
        email: null,
      },
      createdBy: { name: "Maker" },
      lines: [],
    };

    const data = mapInvoiceToPdfData(invoice, { name: "Tenant", isVatRegistered: false });
    const rawSnapshotData = mapInvoiceToPdfData(
      { ...invoice, snapshotCustomerName: "เอบีซี" },
      { name: "Tenant", isVatRegistered: false },
    );

    expect(data.tenantIsVatRegistered).toBe(true);
    expect(data.buyer.name).toBe("บริษัท เอบีซี จำกัด");
    expect(rawSnapshotData.buyer.name).toBe("บริษัท เอบีซี จำกัด");
    expect(data.taxType).toBe("VAT_EXCLUSIVE");
    expect(data.currencyCode).toBe("USD");
  });

  it("maps receipt and tax invoice PDFs with source document tax/currency", () => {
    const receipt = mapReceiptToPdfData(
      {
        receiptNumber: "RC-1",
        status: "DRAFT",
        issueDate: new Date("2026-05-13"),
        billingNature: "GOODS",
        taxType: "NO_VAT",
        currencyCode: "USD",
        grossAmount: 100,
        amount: 100,
        whtRate: 0,
        whtAmount: 0,
        whtCertNumber: null,
        payerName: "Payer",
        payerAddress: null,
        payerTaxId: null,
        notes: null,
        invoice: { invoiceNumber: "BIL-1", customer: null },
      },
      { name: "Tenant", isVatRegistered: false },
    );

    const taxInvoice = mapTaxInvoiceToPdfData(
      {
        taxInvoiceNumber: "TAX-1",
        status: "DRAFT",
        issueDate: new Date("2026-05-13"),
        billingNature: "GOODS",
        taxType: "VAT_INCLUSIVE",
        currencyCode: "EUR",
        buyerName: "Buyer",
        buyerTaxId: null,
        buyerAddress: null,
        buyerBranch: null,
        sellerName: "Seller",
        sellerTaxId: null,
        sellerAddress: null,
        subtotal: 93.46,
        vatRate: 7,
        vatAmount: 6.54,
        totalAmount: 100,
        notes: null,
        invoice: { invoiceNumber: "INV-1", lines: [] },
      },
      { name: "Tenant", isVatRegistered: false },
    );

    expect(receipt.taxType).toBe("NO_VAT");
    expect(receipt.currencyCode).toBe("USD");
    expect(receipt.tenantIsVatRegistered).toBe(false);
    expect(taxInvoice.taxType).toBe("VAT_INCLUSIVE");
    expect(taxInvoice.currencyCode).toBe("EUR");
    expect(taxInvoice.tenantIsVatRegistered).toBe(true);
  });

  it("templates pass currency to money renderers and amount words", () => {
    expect(totalsBoxSource).toContain("currencyCode");
    expect(totalsBoxSource).toContain("formatPdfMoney");
    expect(totalsBoxSource).toContain("pdfAmountText");
    expect(lineItemsSource).toContain("currencyCode");
    expect(lineItemsSource).toContain("formatPdfMoney");
    expect(receiptTemplateSource).toContain("currencyCode={data.currencyCode}");
  });

  it("tax invoice APIs trust document tax type and reject only NO_VAT/zero-VAT invoices", () => {
    expect(taxInvoiceCreateRoute).toContain('invoice.taxType === "NO_VAT"');
    expect(taxInvoiceCreateRoute).toContain("taxType: invoice.taxType");
    expect(taxInvoiceCreateRoute).toContain("currencyCode: invoice.currencyCode");
    expect(taxInvoicePdfRoute).not.toContain("!tenant.isVatRegistered");
    expect(taxInvoicePdfRoute).not.toContain("ยังไม่ได้จดทะเบียนภาษีมูลค่าเพิ่ม");
  });

  it("snapshots formatted legal customer names when creating invoices and tax invoices", () => {
    expect(invoiceCreateRoute).toContain("formatCustomerDisplayName");
    expect(invoiceCreateRoute).toContain("snapshotCustomerName: customerDisplayName");
    expect(invoiceCreateRoute).toContain("juristicType: true");
    expect(invoiceCreateRoute).toContain("individualTitle: true");

    expect(taxInvoiceCreateRoute).toContain("snapshotCustomerName");
    expect(taxInvoiceCreateRoute).toContain("buyerName: invoice.snapshotCustomerName || customerDisplayName");
    expect(taxInvoiceCreateRoute).toContain("buyerTaxId: invoice.snapshotCustomerTaxId");
    expect(taxInvoiceCreateRoute).toMatch(
      /buyerAddress:\s*invoice\.snapshotCustomerAddress/,
    );
  });

  it("rejects a second active tax invoice for the same source invoice", () => {
    expect(taxInvoiceCreateRoute).toContain("taxInvoice.findFirst");
    expect(taxInvoiceCreateRoute).toContain("invoiceId");
    expect(taxInvoiceCreateRoute).toContain("status: { not: \"CANCELLED\" }");
    expect(taxInvoiceCreateRoute).toContain("มีใบกำกับภาษีสำหรับใบแจ้งหนี้นี้แล้ว");
    expect(taxInvoiceCreateRoute.indexOf("taxInvoice.findFirst")).toBeLessThan(
      taxInvoiceCreateRoute.indexOf("tx.taxInvoice.create"),
    );
  });
});
