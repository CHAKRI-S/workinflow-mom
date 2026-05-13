import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = process.cwd();
const formSource = readFileSync(
  join(repoRoot, "src/app/[locale]/(main)/sales/quotations/quotation-form.tsx"),
  "utf8",
);
const listSource = readFileSync(
  join(repoRoot, "src/app/[locale]/(main)/sales/quotations/quotation-list-client.tsx"),
  "utf8",
);
const detailSource = readFileSync(
  join(repoRoot, "src/app/[locale]/(main)/sales/quotations/[id]/quotation-detail-client.tsx"),
  "utf8",
);
const editPageSource = readFileSync(
  join(repoRoot, "src/app/[locale]/(main)/sales/quotations/[id]/edit/page.tsx"),
  "utf8",
);

describe("quotation tax type and currency UI contracts", () => {
  it("uses document tax type as the form tax source of truth instead of customer VAT registration", () => {
    expect(formSource).toContain("TAX_TYPE_OPTIONS");
    expect(formSource).toContain('taxType: "VAT_EXCLUSIVE"');
    expect(formSource).toContain('watch("taxType")');
    expect(formSource).toContain("resolveTaxCalculation");
    expect(formSource).toContain("ประเภทภาษี");
    expect(formSource).toContain("รวม VAT");
    expect(formSource).toContain("แยก VAT");
    expect(formSource).toContain("ไม่มี VAT");
    expect(formSource).not.toContain("selectedCustomer?.isVatRegistered ? 7 : 0");
    expect(formSource).not.toContain('value="PER_LINE">ตามสินค้าแต่ละรายการ');
  });

  it("adds currency selection and no-conversion warning to the form", () => {
    expect(formSource).toContain("CURRENCY_OPTIONS");
    expect(formSource).toContain('currencyCode: "THB"');
    expect(formSource).toContain('watch("currencyCode")');
    expect(formSource).toContain("การเปลี่ยนสกุลเงินไม่แปลงราคาอัตโนมัติ");
    expect(formSource).toContain("formatMoney");
  });

  it("preserves tax type and currency while editing quotations", () => {
    expect(editPageSource).toContain("taxType: serialized.taxType");
    expect(editPageSource).toContain("currencyCode: serialized.currencyCode");
  });

  it("renders tax type badges and formatted currency on list and detail screens", () => {
    for (const source of [listSource, detailSource]) {
      expect(source).toContain("getTaxTypeLabelTh");
      expect(source).toContain("formatMoney");
      expect(source).toContain("currencyCode");
      expect(source).toContain("taxType");
    }
  });
});
