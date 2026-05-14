import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = process.cwd();
const formSource = readFileSync(
  join(repoRoot, "src/app/[locale]/(main)/sales/orders/order-form.tsx"),
  "utf8",
);

describe("direct sales order form tax type and currency UI contracts", () => {
  it("does not expose drawing-source or billing-nature controls in the normal sales order form", () => {
    expect(formSource).not.toContain("BillingNaturePicker");
    expect(formSource).not.toContain("DrawingSourceRow");
    expect(formSource).not.toContain("suggestBillingNature");
    expect(formSource).not.toContain("แบบงาน / Drawing source");
    expect(formSource).not.toContain("auto-classify billing nature");
    expect(formSource).toContain("handleProductChange");
    expect(formSource).toContain("selectProduct");
    expect(formSource).toContain("defaultVatPriceMode");
  });

  it("uses document tax type and calculateDocumentTotals as the preview source of truth", () => {
    expect(formSource).toContain("calculateDocumentTotals");
    expect(formSource).toContain('taxType: "VAT_EXCLUSIVE"');
    expect(formSource).toContain('watch("taxType")');
    expect(formSource).toContain("TAX_TYPE_OPTIONS");
    expect(formSource).toContain("ประเภทภาษี");
    expect(formSource).toContain("รวม VAT");
    expect(formSource).toContain("แยก VAT");
    expect(formSource).toContain("ไม่มี VAT");
    expect(formSource).not.toContain("selectedCustomer?.isVatRegistered");
    expect(formSource).not.toContain("calculateVatTotals(watchLines");
    expect(formSource).not.toContain('value="PER_LINE">ตามสินค้าแต่ละรายการ');
    expect(formSource).not.toContain("บังคับ VAT นอกทั้งบิล");
    expect(formSource).not.toContain("บังคับ VAT ในทั้งบิล");
  });

  it("adds explicit currency selection and formats preview totals with selected currency", () => {
    expect(formSource).toContain("CURRENCY_OPTIONS");
    expect(formSource).toContain('currencyCode: "THB"');
    expect(formSource).toContain('watch("currencyCode")');
    expect(formSource).toContain("การเปลี่ยนสกุลเงินไม่แปลงราคาอัตโนมัติ");
    expect(formSource).toContain("formatMoney");
    expect(formSource).not.toContain("n.toLocaleString");
  });

  it("submits tax type and currency through the sales order schema payload", () => {
    expect(formSource).toContain("salesOrderCreateSchema");
    expect(formSource).toContain("JSON.stringify(data)");
    expect(formSource).toContain("taxType");
    expect(formSource).toContain("currencyCode");
  });
});
