import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = process.cwd();
const newInvoicePageSource = readFileSync(
  join(repoRoot, "src/app/[locale]/(main)/finance/invoices/new/page.tsx"),
  "utf8",
);
const invoiceFormSource = readFileSync(
  join(repoRoot, "src/app/[locale]/(main)/finance/invoices/new/invoice-form-client.tsx"),
  "utf8",
);

describe("invoice from sales order tax type and currency UI contracts", () => {
  it("loads sales order document tax type and currency for invoice creation", () => {
    expect(newInvoicePageSource).toContain("taxType: true");
    expect(newInvoicePageSource).toContain("currencyCode: true");
  });

  it("calculates preview totals from inherited sales order tax type instead of customer VAT registration", () => {
    expect(invoiceFormSource).toContain("calculateDocumentTotals");
    expect(invoiceFormSource).toContain("selectedSO.taxType");
    expect(invoiceFormSource).toContain("selectedSO.currencyCode");
    expect(invoiceFormSource).toContain("getTaxTypeLabelTh");
    expect(invoiceFormSource).toContain("formatMoney");
    expect(invoiceFormSource).not.toContain("selectedSO.customer.isVatRegistered ? 7 : 0");
    expect(invoiceFormSource).not.toContain("calculateVatTotals(lineDrafts");
  });

  it("shows inherited Thai tax labels and currency, not editable legacy VAT mode choices", () => {
    expect(invoiceFormSource).toContain("ประเภทภาษีจาก Sales Order");
    expect(invoiceFormSource).toContain("สกุลเงินจาก Sales Order");
    expect(invoiceFormSource).toContain("รวม VAT");
    expect(invoiceFormSource).toContain("แยก VAT");
    expect(invoiceFormSource).toContain("ไม่มี VAT");
    expect(invoiceFormSource).not.toContain('value="PER_LINE">ตามสินค้าแต่ละรายการ');
    expect(invoiceFormSource).not.toContain("บังคับ VAT นอกทั้งบิล");
    expect(invoiceFormSource).not.toContain("บังคับ VAT ในทั้งบิล");
  });

  it("submits inherited tax type and currency explicitly with the invoice request", () => {
    expect(invoiceFormSource).toContain("taxType: selectedSO.taxType");
    expect(invoiceFormSource).toContain("currencyCode: selectedSO.currencyCode");
  });
});
